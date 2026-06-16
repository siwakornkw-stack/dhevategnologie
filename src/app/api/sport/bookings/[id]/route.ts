import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { BookingStatus, Prisma } from '@prisma/client';
import { sendBookingApprovedEmail, sendBookingCancelledEmail, sendBookingRejectedEmail } from '@/lib/email';
import { notifyLineBookingStatus } from '@/lib/line-notify';
import { stripe } from '@/lib/stripe';
import { notifyWaitingList } from '@/lib/waiting-list-notify';
import { sendPushToUser } from '@/lib/web-push';
import { calculatePriceWithRules } from '@/lib/booking';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';

const REFERRAL_BONUS = 50;
const CANCEL_DEADLINE_HOURS = 2;

// Valid status transitions per current status
const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { field: { select: { id: true, name: true, sportType: true, imageUrl: true, location: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = session.user.role === 'ADMIN';
  const isOwner = booking.userId === session.user.id;
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(booking);
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function parseSlot(ts: string): [number, number] | null {
  const parts = ts.split('-');
  if (parts.length !== 2) return null;
  const s = toMinutes(parts[0]);
  let e = toMinutes(parts[1]);
  if (isNaN(s) || isNaN(e) || s === e) return null;
  if (e < s) e += 1440;
  return [s, e];
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`booking-mutate:${session.user.id}`, BOOKING_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คำขอเกินจำนวนที่กำหนด' }, { status: 429 });

  const { id } = await params;
  const body = await req.json();
  const { status, date: newDate, timeSlot: newTimeSlot } = body as {
    status?: BookingStatus;
    date?: string;
    timeSlot?: string;
  };

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = session.user.role === 'ADMIN';
  const isCashier = session.user.role === 'CASHIER';
  const isOwner = booking.userId === session.user.id;

  // CASHIER is allowed in for reschedule only (status changes are blocked below).
  if (!isAdmin && !isCashier && !isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ADMIN/CASHIER: reschedule (change date/timeSlot) without touching status
  if (!status && (newDate || newTimeSlot)) {
    if (!isAdmin && !isCashier) return NextResponse.json({ error: 'Admin/Cashier เท่านั้น' }, { status: 403 });
    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      return NextResponse.json({ error: 'การจองนี้ถูกยกเลิก/ปฏิเสธแล้ว แก้ไม่ได้' }, { status: 422 });
    }

    const targetDateStr = newDate ?? booking.date.toISOString();
    const targetSlot = newTimeSlot ?? booking.timeSlot;

    const targetDate = new Date(targetDateStr);
    if (isNaN(targetDate.getTime())) return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });

    const parsed = parseSlot(targetSlot);
    if (!parsed) return NextResponse.json({ error: 'รูปแบบช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
    const [s, e] = parsed;
    if (e - s < 5) return NextResponse.json({ error: 'ระยะเวลาขั้นต่ำ 5 นาที' }, { status: 400 });

    const [field, blocked] = await Promise.all([
      prisma.field.findUnique({
        where: { id: booking.fieldId },
        select: { openTime: true, closeTime: true },
      }),
      prisma.fieldBlockedDate.findFirst({ where: { fieldId: booking.fieldId, date: targetDate } }),
    ]);
    if (!field) return NextResponse.json({ error: 'ไม่พบสนาม' }, { status: 404 });
    if (blocked) {
      return NextResponse.json(
        { error: `สนามปิดให้บริการในวันนี้${blocked.reason ? `: ${blocked.reason}` : ''}` },
        { status: 409 }
      );
    }

    const fieldOpen = toMinutes(field.openTime);
    let fieldClose = toMinutes(field.closeTime);
    if (fieldClose <= fieldOpen) fieldClose += 1440;
    let slotStart = s;
    let slotEnd = e;
    if (slotStart < fieldOpen) { slotStart += 1440; slotEnd += 1440; }
    if (slotStart < fieldOpen || slotEnd > fieldClose) {
      return NextResponse.json(
        { error: `เวลาต้องอยู่ในช่วง ${field.openTime}–${field.closeTime} น.` },
        { status: 400 }
      );
    }

    const prevDate = booking.date;
    const prevTimeSlot = booking.timeSlot;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.booking.findMany({
          where: {
            fieldId: booking.fieldId,
            date: targetDate,
            status: { in: ['PENDING', 'APPROVED'] },
            id: { not: id },
          },
          select: { timeSlot: true },
        });
        const conflict = existing.some((b) => {
          const p = parseSlot(b.timeSlot);
          return p ? overlaps(s, e, p[0], p[1]) : false;
        });
        if (conflict) throw new Error('conflict');

        return tx.booking.update({
          where: { id },
          data: { date: targetDate, timeSlot: targetSlot },
          include: {
            field: { select: { name: true } },
            user: { select: { email: true, name: true, notifEmail: true, notifInApp: true } },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      // Notify user of reschedule + free up the old slot for waiting list
      const dateLabel = updated.date.toLocaleDateString('th-TH');
      const msgBody = `${updated.field.name} · ${dateLabel} เวลา ${updated.timeSlot} น. (เดิม ${prevDate.toLocaleDateString('th-TH')} ${prevTimeSlot})`;

      const tasks: Promise<unknown>[] = [];
      if (updated.user.notifInApp) {
        tasks.push(
          prisma.notification.create({
            data: {
              userId: updated.userId,
              type: 'BOOKING_RESCHEDULED',
              title: 'การจองถูกเปลี่ยนเวลา',
              message: msgBody,
              link: '/sport/bookings',
            },
          }).catch(() => {}),
          sendPushToUser(updated.userId, {
            title: 'การจองถูกเปลี่ยนเวลา',
            message: msgBody,
            link: '/sport/bookings',
          }).catch(() => {}),
        );
      }
      if (tasks.length > 0) await Promise.allSettled(tasks);

      notifyWaitingList(booking.fieldId, prevDate, prevTimeSlot).catch(() => {});

      return NextResponse.json(updated);
    } catch (err) {
      const msg = err instanceof Error && err.message === 'conflict'
        ? 'ช่วงเวลานี้ถูกจองแล้ว'
        : 'แก้ไขไม่สำเร็จ';
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  }

  if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 });

  // Status changes are owner-self-cancel or ADMIN only. CASHIER (non-owner) cannot change status here.
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'ไม่มีสิทธิ์เปลี่ยนสถานะการจอง' }, { status: 403 });

  if (!isAdmin && status !== 'CANCELLED') return NextResponse.json({ error: 'ผู้ใช้ทำได้แค่ยกเลิกเท่านั้น' }, { status: 403 });

  // State machine: validate the transition is allowed
  const validNext = VALID_TRANSITIONS[booking.status];
  if (!validNext.includes(status)) {
    return NextResponse.json(
      { error: `ไม่สามารถเปลี่ยนจาก ${booking.status} เป็น ${status} ได้` },
      { status: 422 }
    );
  }

  // Cancellation deadline: users cannot cancel within CANCEL_DEADLINE_HOURS of start.
  // Applies to APPROVED bookings AND already-paid PENDING bookings (awaiting approval) —
  // an unpaid PENDING booking has nothing to refund and stays freely cancellable.
  // booking.date stores UTC midnight of the Bangkok day; timeSlot is Bangkok local time.
  // Compute booking start in UTC as that day's UTC midnight + (hours - 7) to match Asia/Bangkok (UTC+7).
  const deadlineApplies = booking.status === 'APPROVED' || (booking.status === 'PENDING' && booking.paidAt != null);
  if (!isAdmin && status === 'CANCELLED' && deadlineApplies) {
    const [startStr] = booking.timeSlot.split('-');
    const [h, m] = startStr.split(':').map(Number);
    const BANGKOK_UTC_OFFSET_HOURS = 7;
    const bookingStart = new Date(booking.date);
    bookingStart.setUTCHours(h - BANGKOK_UTC_OFFSET_HOURS, m, 0, 0);
    const hoursUntil = (bookingStart.getTime() - Date.now()) / 3_600_000;
    if (hoursUntil < CANCEL_DEADLINE_HOURS) {
      return NextResponse.json(
        { error: `ไม่สามารถยกเลิกได้ กรุณายกเลิกก่อนเริ่มอย่างน้อย ${CANCEL_DEADLINE_HOURS} ชั่วโมง` },
        { status: 422 }
      );
    }
  }

  // --- Atomic transaction: status change + all financial side-effects ---
  // TOCTOU guard: only flip status if it still matches the value we validated against
  // VALID_TRANSITIONS. If a concurrent request already changed it, claim.count === 0
  // and we throw STATUS_RACE so the caller sees 409 instead of double-applying side-effects.
  const txResult = await prisma.$transaction(async (tx) => {
    const claim = await tx.booking.updateMany({
      where: { id, status: booking.status },
      data: { status },
    });
    if (claim.count !== 1) {
      throw Object.assign(new Error('STATUS_RACE'), { isRace: true });
    }
    const b = await tx.booking.findUnique({
      where: { id },
      include: {
        field: {
          select: {
            name: true,
            pricePerHour: true,
            priceRules: { select: { startTime: true, endTime: true, pricePerHour: true } },
          },
        },
        user: { select: { name: true, email: true, notifEmail: true, notifInApp: true, referredById: true } },
      },
    });
    if (!b) throw Object.assign(new Error('STATUS_RACE'), { isRace: true });

    if (status === 'APPROVED') {
      const [s, e] = booking.timeSlot.split('-');
      const base = calculatePriceWithRules(s, e, b.field.pricePerHour, b.field.priceRules || []);
      const paidAmount = Math.max(0, base - (booking.discountAmount ?? 0));
      const pointsEarned = Math.floor(paidAmount / 10);

      if (pointsEarned > 0) {
        await tx.user.update({ where: { id: b.userId }, data: { points: { increment: pointsEarned } } });
        await tx.pointTransaction.create({
          data: { userId: b.userId, points: pointsEarned, type: 'EARN', bookingId: id, note: `จากการจอง ${b.field.name}` },
        });
        await tx.booking.update({ where: { id }, data: { pointsEarned } });
      }

      // Referral bonus on user's first approved booking.
      // Atomic claim: updateMany sets referralBonusGrantedAt only if still null,
      // so concurrent approvals can only grant the bonus once.
      if (b.user.referredById) {
        const referrerId = b.user.referredById;
        const claimed = await tx.user.updateMany({
          where: { id: b.userId, referralBonusGrantedAt: null },
          data: { referralBonusGrantedAt: new Date() },
        });
        if (claimed.count === 1) {
          await tx.user.update({ where: { id: referrerId }, data: { points: { increment: REFERRAL_BONUS } } });
          await tx.pointTransaction.create({
            data: { userId: referrerId, points: REFERRAL_BONUS, type: 'EARN', note: 'โบนัสแนะนำเพื่อน' },
          });
          await tx.notification.create({
            data: {
              userId: referrerId,
              type: 'REFERRAL_BONUS',
              title: 'ได้รับโบนัสแนะนำเพื่อน',
              message: `คุณได้รับ ${REFERRAL_BONUS} แต้มจากการที่เพื่อนจองสนามครั้งแรก`,
              link: '/sport/profile',
            },
          });
        }
      }
    } else if (status === 'REJECTED' || status === 'CANCELLED') {
      // Restore redeemed points
      if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
        await tx.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } });
        await tx.pointTransaction.create({
          data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId: id, note: 'คืนแต้มเนื่องจากการยกเลิก/ปฏิเสธการจอง' },
        });
      }
      // Deduct earned points (if previously approved) — clamp to current balance to avoid negative
      if (booking.pointsEarned && booking.pointsEarned > 0) {
        const cur = await tx.user.findUnique({ where: { id: booking.userId }, select: { points: true } });
        const deduct = Math.min(booking.pointsEarned, cur?.points ?? 0);
        if (deduct > 0) {
          await tx.user.update({ where: { id: booking.userId }, data: { points: { decrement: deduct } } });
        }
        await tx.pointTransaction.create({
          data: { userId: booking.userId, points: -deduct, type: 'REDEEM', bookingId: id, note: 'หักแต้มเนื่องจากการยกเลิก/ปฏิเสธการจอง' },
        });
      }
      // Revert coupon usage count
      if (booking.couponCode) {
        await tx.coupon.update({
          where: { code: booking.couponCode },
          data: { usedCount: { decrement: 1 } },
        });
      }
      // Detach any open PosTab still linked to this booking so team label / link don't dangle.
      // Skip CLOSED/PAID/VOID tabs to preserve historical association on finalized bills.
      await tx.posTab.updateMany({
        where: { bookingId: id, status: { in: ['OPEN', 'HELD'] } },
        data: { bookingId: null, teamLabel: null },
      });
    }

    return b;
  }).catch((err: unknown) => {
    if (err && typeof err === 'object' && (err as { isRace?: boolean }).isRace) {
      return null;
    }
    throw err;
  });
  if (txResult === null) {
    return NextResponse.json({ error: 'การจองถูกแก้ไขโดยผู้ใช้อื่น โปรดรีโหลด' }, { status: 409 });
  }
  const updated = txResult;

  // --- Post-transaction side-effects (external services, fire-and-forget) ---
  const emailData = {
    userName: updated.user.name ?? 'ลูกค้า',
    fieldName: updated.field.name,
    date: updated.date.toLocaleDateString('th-TH'),
    timeSlot: updated.timeSlot,
  };

  const notifTasks: Promise<unknown>[] = [];

  if (status === 'APPROVED') {
    if (updated.user.notifEmail) notifTasks.push(sendBookingApprovedEmail(updated.user.email, emailData).catch(() => {}));
    notifTasks.push(notifyLineBookingStatus('APPROVED', emailData).catch(() => {}));
    if (updated.user.notifInApp) {
      notifTasks.push(
        prisma.notification.create({
          data: { userId: updated.userId, type: 'BOOKING_APPROVED', title: 'การจองได้รับการอนุมัติ', message: `${updated.field.name} · ${emailData.date} เวลา ${updated.timeSlot} น.`, link: '/sport/bookings' },
        }).catch(() => {}),
        sendPushToUser(updated.userId, { title: 'การจองได้รับการอนุมัติ', message: `${updated.field.name} · ${emailData.date} เวลา ${updated.timeSlot} น.`, link: '/sport/bookings' }).catch(() => {}),
      );
    }
  } else if (status === 'REJECTED') {
    if (updated.user.notifEmail) notifTasks.push(sendBookingRejectedEmail(updated.user.email, emailData).catch(() => {}));
    notifTasks.push(notifyLineBookingStatus('REJECTED', emailData).catch(() => {}));
    if (updated.user.notifInApp) {
      notifTasks.push(
        prisma.notification.create({
          data: { userId: updated.userId, type: 'BOOKING_REJECTED', title: 'การจองถูกปฏิเสธ', message: `${updated.field.name} · ${emailData.date} เวลา ${updated.timeSlot} น.`, link: '/sport/bookings' },
        }).catch(() => {}),
        sendPushToUser(updated.userId, { title: 'การจองถูกปฏิเสธ', message: `${updated.field.name} · ${emailData.date}`, link: '/sport/bookings' }).catch(() => {}),
      );
    }
    if (booking.paidAt && booking.stripePaymentIntentId) {
      const stripeEnabled = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your');
      // idempotencyKey scoped to booking+intent prevents duplicate refund on retry
      if (stripeEnabled) notifTasks.push(stripe.refunds.create(
        { payment_intent: booking.stripePaymentIntentId },
        { idempotencyKey: `refund:${id}:${booking.stripePaymentIntentId}` },
      ).catch(() => {}));
    }
  } else if (status === 'CANCELLED') {
    if (updated.user.notifEmail) notifTasks.push(sendBookingCancelledEmail(updated.user.email, emailData).catch(() => {}));
    if (booking.paidAt && booking.stripePaymentIntentId) {
      const stripeEnabled = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your');
      if (stripeEnabled) notifTasks.push(stripe.refunds.create(
        { payment_intent: booking.stripePaymentIntentId },
        { idempotencyKey: `refund:${id}:${booking.stripePaymentIntentId}` },
      ).catch(() => {}));
    }
  }

  if (notifTasks.length > 0) await Promise.allSettled(notifTasks);

  if (status === 'CANCELLED' || status === 'REJECTED') {
    notifyWaitingList(booking.fieldId, booking.date, booking.timeSlot).catch(() => {});
  }

  return NextResponse.json(updated);
}
