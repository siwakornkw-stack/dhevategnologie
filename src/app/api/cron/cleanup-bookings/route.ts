import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cancel PENDING bookings from incomplete Stripe checkouts older than 2 hours.
// Stripe sessions expire in 24h but we clean up earlier so slots aren't blocked all day.
// Called by Vercel Cron (see vercel.json) — protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

  const { count } = await prisma.booking.updateMany({
    where: {
      status: 'PENDING',
      stripeSessionId: { not: null }, // only checkout-initiated bookings
      createdAt: { lt: cutoff },
    },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({ cancelled: count });
}
