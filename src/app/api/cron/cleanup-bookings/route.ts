import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyWaitingList } from '@/lib/waiting-list-notify';
import { verifyCronSecret } from '@/lib/cron-auth';

// Cancel PENDING bookings from incomplete Stripe checkouts older than 2 hours.
// Stripe sessions expire in 24h but we clean up earlier so slots aren't blocked all day.
// Called by Vercel Cron (see vercel.json) — protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  // Bearer header only — query-string secret leaks into proxy/CDN access logs.
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripeCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
  const manualCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const toCancel = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      // Never reap a booking that was actually paid (PromptPay settles async, leaving the
      // booking PENDING with paidAt set until an admin approves it). Cancelling it here would
      // strand a paid customer with no slot and no refund.
      paidAt: null,
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

  // Cancel each booking with a guarded update, and reverse its coupon/points ONLY when this
  // run actually transitioned the row (res.count === 1). Between the findMany above and this tx
  // a concurrent webhook (sets paidAt) or admin approval can flip a row out of PENDING; reversing
  // from the stale pre-read would wrongly free coupon usage / restore points for a booking we
  // never cancelled. Tying every reversal to the guarded update keeps them in lockstep.
  const cancelled: typeof toCancel = [];
  await prisma.$transaction(async (tx) => {
    for (const b of toCancel) {
      const res = await tx.booking.updateMany({
        where: { id: b.id, status: 'PENDING', paidAt: null },
        data: { status: 'CANCELLED' },
      });
      if (res.count === 0) continue; // concurrently paid/approved/cancelled — leave it alone
      cancelled.push(b);
      if (b.couponCode) {
        await tx.coupon.updateMany({ where: { code: b.couponCode, usedCount: { gte: 1 } }, data: { usedCount: { decrement: 1 } } });
      }
      if (b.pointsRedeemed && b.pointsRedeemed > 0) {
        await tx.user.update({ where: { id: b.userId }, data: { points: { increment: b.pointsRedeemed } } });
        await tx.pointTransaction.create({
          data: { userId: b.userId, points: b.pointsRedeemed, type: 'EARN', bookingId: b.id, note: 'คืนแต้มเนื่องจาก Stripe session หมดอายุ' },
        });
      }
    }
  });

  // Notify waiting list for each freed slot (only the rows we actually cancelled)
  const seen = new Set<string>();
  await Promise.allSettled(
    cancelled.map((b) => {
      const key = `${b.fieldId}:${b.date.toISOString()}:${b.timeSlot}`;
      if (seen.has(key)) return Promise.resolve();
      seen.add(key);
      return notifyWaitingList(b.fieldId, b.date, b.timeSlot).catch(() => {});
    }),
  );

  return NextResponse.json({ cancelled: cancelled.length });
}
