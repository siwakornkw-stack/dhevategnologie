import { NextRequest, NextResponse } from 'next/server';
import { Prisma, BookingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';
import { hasSlotConflict } from '@/lib/booking';
import { stripe } from '@/lib/stripe';
import { notifyWaitingList } from '@/lib/waiting-list-notify';

const stripeEnabled =
  !!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your');

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function todayUtcMidnight(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Reverse points/coupon side-effects and detach open tabs for one booking inside a tx,
// then atomically flip its status to CANCELLED. Mirrors the CANCELLED path in
// api/sport/bookings/[id]/route.ts so financial state stays consistent even if a
// recurring booking was later paid or had points/coupons attached.
async function cancelBookingTx(
  tx: Prisma.TransactionClient,
  b: {
    id: string;
    userId: string;
    status: BookingStatus;
    pointsRedeemed: number | null;
    pointsEarned: number | null;
    couponCode: string | null;
  },
): Promise<boolean> {
  const claim = await tx.booking.updateMany({
    where: { id: b.id, status: b.status },
    data: { status: 'CANCELLED' },
  });
  if (claim.count !== 1) return false;

  if (b.pointsRedeemed && b.pointsRedeemed > 0) {
    await tx.user.update({ where: { id: b.userId }, data: { points: { increment: b.pointsRedeemed } } });
    await tx.pointTransaction.create({
      data: { userId: b.userId, points: b.pointsRedeemed, type: 'EARN', bookingId: b.id, note: 'คืนแต้มเนื่องจากการยกเลิกการจอง' },
    });
  }
  if (b.pointsEarned && b.pointsEarned > 0) {
    const cur = await tx.user.findUnique({ where: { id: b.userId }, select: { points: true } });
    const deduct = Math.min(b.pointsEarned, cur?.points ?? 0);
    if (deduct > 0) {
      await tx.user.update({ where: { id: b.userId }, data: { points: { decrement: deduct } } });
    }
    await tx.pointTransaction.create({
      data: { userId: b.userId, points: -deduct, type: 'REDEEM', bookingId: b.id, note: 'หักแต้มเนื่องจากการยกเลิกการจอง' },
    });
  }
  if (b.couponCode) {
    await tx.coupon.update({ where: { code: b.couponCode }, data: { usedCount: { decrement: 1 } } });
  }
  await tx.posTab.updateMany({
    where: { bookingId: b.id, status: { in: ['OPEN', 'HELD'] } },
    data: { bookingId: null, teamLabel: null },
  });
  return true;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin เท่านั้น' }, { status: 403 });
  }

  const rl = await rateLimit(`recurring-group:${session.user.id}`, BOOKING_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คำขอเกินจำนวนที่กำหนด' }, { status: 429 });

  const { groupId } = await params;
  const body = await req.json();
  const action = body.action as 'cancel' | 'reschedule';
  const scope = (body.scope as 'future' | 'all') ?? 'future';

  const bookings = await prisma.booking.findMany({
    where: { recurringGroupId: groupId },
    select: {
      id: true, userId: true, fieldId: true, date: true, timeSlot: true, status: true,
      pointsRedeemed: true, pointsEarned: true, couponCode: true,
      paidAt: true, stripePaymentIntentId: true,
    },
    orderBy: { date: 'asc' },
  });
  if (bookings.length === 0) return NextResponse.json({ error: 'ไม่พบกลุ่มการจองซ้ำ' }, { status: 404 });

  const cutoff = todayUtcMidnight();
  const inScope = bookings.filter((b) => {
    if (b.status !== 'PENDING' && b.status !== 'APPROVED') return false;
    if (scope === 'future' && b.date < cutoff) return false;
    return true;
  });

  if (action === 'cancel') {
    let cancelled = 0;
    const refundIntents: string[] = [];
    const waitingSlots: { fieldId: string; date: Date; timeSlot: string }[] = [];

    for (const b of inScope) {
      const ok = await prisma.$transaction(
        (tx) => cancelBookingTx(tx, b),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ).catch(() => false);
      if (!ok) continue;
      cancelled++;
      if (b.paidAt && b.stripePaymentIntentId) refundIntents.push(`${b.id}|${b.stripePaymentIntentId}`);
      waitingSlots.push({ fieldId: b.fieldId, date: b.date, timeSlot: b.timeSlot });
    }

    const tasks: Promise<unknown>[] = [];
    if (stripeEnabled) {
      for (const r of refundIntents) {
        const [bid, intent] = r.split('|');
        tasks.push(
          stripe.refunds.create(
            { payment_intent: intent },
            { idempotencyKey: `refund:${bid}:${intent}` },
          ).catch(() => {}),
        );
      }
    }
    await Promise.allSettled(tasks);
    for (const s of waitingSlots) notifyWaitingList(s.fieldId, s.date, s.timeSlot).catch(() => {});

    return NextResponse.json({ cancelled, total: inScope.length });
  }

  if (action === 'reschedule') {
    const newTimeSlot = body.timeSlot as string;
    if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(newTimeSlot ?? '')) {
      return NextResponse.json({ error: 'รูปแบบช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
    }

    const field = await prisma.field.findUnique({
      where: { id: bookings[0].fieldId },
      select: { openTime: true, closeTime: true },
    });
    if (!field) return NextResponse.json({ error: 'ไม่พบสนาม' }, { status: 404 });

    const [s0, e0] = newTimeSlot.split('-');
    const fieldOpen = toMin(field.openTime);
    let fieldClose = toMin(field.closeTime);
    if (fieldClose <= fieldOpen) fieldClose += 1440;
    let slotStart = toMin(s0);
    let slotEnd = toMin(e0);
    if (slotEnd <= slotStart) slotEnd += 1440;
    if (slotStart < fieldOpen) { slotStart += 1440; slotEnd += 1440; }
    if (slotStart < fieldOpen || slotEnd > fieldClose) {
      return NextResponse.json(
        { error: `เวลาต้องอยู่ในช่วง ${field.openTime}–${field.closeTime} น.` },
        { status: 400 },
      );
    }

    let updated = 0;
    const conflicts: string[] = [];
    for (const b of inScope) {
      if (b.timeSlot === newTimeSlot) { updated++; continue; }
      try {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.booking.findMany({
            where: {
              fieldId: b.fieldId,
              date: b.date,
              status: { in: ['PENDING', 'APPROVED'] },
              id: { not: b.id },
            },
            select: { timeSlot: true },
          });
          if (hasSlotConflict(existing.map((x) => x.timeSlot), [newTimeSlot])) {
            throw new Error('conflict');
          }
          await tx.booking.update({ where: { id: b.id }, data: { timeSlot: newTimeSlot } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        updated++;
      } catch {
        conflicts.push(b.date.toLocaleDateString('th-TH'));
      }
    }
    return NextResponse.json({ updated, total: inScope.length, conflicts });
  }

  return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
}

// Append one more occurrence to an existing recurring group.
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin เท่านั้น' }, { status: 403 });
  }

  const rl = await rateLimit(`recurring-group:${session.user.id}`, BOOKING_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คำขอเกินจำนวนที่กำหนด' }, { status: 429 });

  const { groupId } = await params;
  const body = await req.json();
  const dateStr = body.date as string;
  if (!dateStr) return NextResponse.json({ error: 'ต้องระบุวันที่' }, { status: 400 });

  const group = await prisma.booking.findFirst({
    where: { recurringGroupId: groupId },
    orderBy: { date: 'asc' },
    select: { userId: true, fieldId: true, timeSlot: true },
  });
  if (!group) return NextResponse.json({ error: 'ไม่พบกลุ่มการจองซ้ำ' }, { status: 404 });

  const timeSlot = (body.timeSlot as string) || group.timeSlot;
  if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(timeSlot)) {
    return NextResponse.json({ error: 'รูปแบบช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
  date.setUTCHours(0, 0, 0, 0);

  const [field, blocked] = await Promise.all([
    prisma.field.findUnique({
      where: { id: group.fieldId, isActive: true },
      select: { openTime: true, closeTime: true },
    }),
    prisma.fieldBlockedDate.findFirst({ where: { fieldId: group.fieldId, date } }),
  ]);
  if (!field) return NextResponse.json({ error: 'ไม่พบสนามหรือสนามปิด' }, { status: 404 });
  if (blocked) return NextResponse.json({ error: 'สนามปิดในวันนี้' }, { status: 409 });

  const [s0, e0] = timeSlot.split('-');
  const fieldOpen = toMin(field.openTime);
  let fieldClose = toMin(field.closeTime);
  if (fieldClose <= fieldOpen) fieldClose += 1440;
  let slotStart = toMin(s0);
  let slotEnd = toMin(e0);
  if (slotEnd <= slotStart) slotEnd += 1440;
  if (slotStart < fieldOpen) { slotStart += 1440; slotEnd += 1440; }
  if (slotStart < fieldOpen || slotEnd > fieldClose) {
    return NextResponse.json(
      { error: `เวลาต้องอยู่ในช่วง ${field.openTime}–${field.closeTime} น.` },
      { status: 400 },
    );
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findMany({
        where: { fieldId: group.fieldId, date, status: { in: ['PENDING', 'APPROVED'] } },
        select: { timeSlot: true },
      });
      if (hasSlotConflict(existing.map((x) => x.timeSlot), [timeSlot])) {
        throw new Error('conflict');
      }
      return tx.booking.create({
        data: {
          userId: group.userId,
          fieldId: group.fieldId,
          date,
          timeSlot,
          isRecurring: true,
          recurringGroupId: groupId,
          status: 'APPROVED',
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ booking }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'ช่วงเวลานี้ถูกจองแล้ว' }, { status: 409 });
  }
}
