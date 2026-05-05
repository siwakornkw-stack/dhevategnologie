import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyWaitingList } from '@/lib/waiting-list-notify';

// Cancel PENDING bookings from incomplete Stripe checkouts older than 2 hours.
// Stripe sessions expire in 24h but we clean up earlier so slots aren't blocked all day.
// Called by Vercel Cron (see vercel.json) — protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripeCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
  const manualCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const toCancel = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      OR: [
        // Stripe checkout sessions older than 2 hours
        { stripeSessionId: { not: null }, createdAt: { lt: stripeCutoff } },
        // Non-Stripe (free/manual) pending bookings older than 24 hours
        { stripeSessionId: null, createdAt: { lt: manualCutoff } },
      ],
    },
    select: { id: true, couponCode: true, pointsRedeemed: true, userId: true, fieldId: true, date: true, timeSlot: true },
  });

  if (toCancel.length === 0) return NextResponse.json({ cancelled: 0 });

  await prisma.booking.updateMany({
    where: { id: { in: toCancel.map((b) => b.id) } },
    data: { status: 'CANCELLED' },
  });

  // Decrement coupon usedCount
  const couponDecrements: Record<string, number> = {};
  for (const b of toCancel) {
    if (b.couponCode) couponDecrements[b.couponCode] = (couponDecrements[b.couponCode] ?? 0) + 1;
  }

  // Restore redeemed points per user
  const pointRestores: Record<string, number> = {};
  const pointBookings: { userId: string; points: number; bookingId: string }[] = [];
  for (const b of toCancel) {
    if (b.pointsRedeemed && b.pointsRedeemed > 0) {
      pointRestores[b.userId] = (pointRestores[b.userId] ?? 0) + b.pointsRedeemed;
      pointBookings.push({ userId: b.userId, points: b.pointsRedeemed, bookingId: b.id });
    }
  }

  const tasks: Promise<unknown>[] = [];

  for (const [code, n] of Object.entries(couponDecrements)) {
    tasks.push(prisma.coupon.update({ where: { code }, data: { usedCount: { decrement: n } } }).catch(() => {}));
  }

  for (const [userId, points] of Object.entries(pointRestores)) {
    tasks.push(prisma.user.update({ where: { id: userId }, data: { points: { increment: points } } }).catch(() => {}));
  }

  for (const { userId, points, bookingId } of pointBookings) {
    tasks.push(
      prisma.pointTransaction.create({
        data: { userId, points, type: 'EARN', bookingId, note: 'คืนแต้มเนื่องจาก Stripe session หมดอายุ' },
      }).catch(() => {}),
    );
  }

  if (tasks.length > 0) await Promise.allSettled(tasks);

  // Notify waiting list for each freed slot
  const seen = new Set<string>();
  await Promise.allSettled(
    toCancel.map((b) => {
      const key = `${b.fieldId}:${b.date.toISOString()}:${b.timeSlot}`;
      if (seen.has(key)) return Promise.resolve();
      seen.add(key);
      return notifyWaitingList(b.fieldId, b.date, b.timeSlot).catch(() => {});
    }),
  );

  return NextResponse.json({ cancelled: toCancel.length });
}
