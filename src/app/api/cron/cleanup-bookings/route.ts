import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cancel PENDING bookings from incomplete Stripe checkouts older than 2 hours.
// Stripe sessions expire in 24h but we clean up earlier so slots aren't blocked all day.
// Called by Vercel Cron (see vercel.json) — protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

  const toCancel = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      stripeSessionId: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, couponCode: true },
  });

  if (toCancel.length === 0) return NextResponse.json({ cancelled: 0 });

  await prisma.booking.updateMany({
    where: { id: { in: toCancel.map((b) => b.id) } },
    data: { status: 'CANCELLED' },
  });

  // Decrement coupon usedCount for each cancelled booking that used one
  const couponDecrements: Record<string, number> = {};
  for (const b of toCancel) {
    if (b.couponCode) couponDecrements[b.couponCode] = (couponDecrements[b.couponCode] ?? 0) + 1;
  }
  if (Object.keys(couponDecrements).length > 0) {
    await Promise.allSettled(
      Object.entries(couponDecrements).map(([code, n]) =>
        prisma.coupon.update({ where: { code }, data: { usedCount: { decrement: n } } }),
      ),
    );
  }

  return NextResponse.json({ cancelled: toCancel.length });
}
