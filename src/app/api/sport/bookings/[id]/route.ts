import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { BookingStatus } from '@prisma/client';
import { sendBookingApprovedEmail, sendBookingCancelledEmail, sendBookingRejectedEmail } from '@/lib/email';
import { notifyLineBookingStatus } from '@/lib/line-notify';
import { stripe } from '@/lib/stripe';
import { notifyWaitingList } from '@/lib/waiting-list-notify';
import { sendPushToUser } from '@/lib/web-push';

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status: BookingStatus };

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = session.user.role === 'ADMIN';
  const isOwner = booking.userId === session.user.id;

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin && status !== 'CANCELLED') return NextResponse.json({ error: 'ผู้ใช้ทำได้แค่ยกเลิกเท่านั้น' }, { status: 403 });

  // State machine: validate the transition is allowed
  const validNext = VALID_TRANSITIONS[booking.status];
  if (!validNext.includes(status)) {
    return NextResponse.json(
      { error: `ไม่สามารถเปลี่ยนจาก ${booking.status} เป็น ${status} ได้` },
      { status: 422 }
    );
  }

  // Cancellation deadline: users cannot cancel APPROVED bookings within CANCEL_DEADLINE_HOURS of start
  // PENDING bookings (payment not completed) are always cancellable
  if (!isAdmin && status === 'CANCELLED' && booking.status === 'APPROVED') {
    const [startStr] = booking.timeSlot.split('-');
    const [h, m] = startStr.split(':').map(Number);
    const bookingStart = new Date(booking.date);
    bookingStart.setHours(h, m, 0, 0);
    const hoursUntil = (bookingStart.getTime() - Date.now()) / 3_600_000;
    if (hoursUntil < CANCEL_DEADLINE_HOURS) {
      return NextResponse.json(
        { error: `ไม่สามารถยกเลิกได้ กรุณายกเลิกก่อนเริ่มอย่างน้อย ${CANCEL_DEADLINE_HOURS} ชั่วโมง` },
        { status: 422 }
      );
    }
  }

  // --- Atomic transaction: status change + all financial side-effects ---
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({
      where: { id },
      data: { status },
      include: {
        field: { select: { name: true, pricePerHour: true } },
        user: { select: { name: true, email: true, notifEmail: true, notifLine: true, notifInApp: true, referredById: true } },
      },
    });

    if (status === 'APPROVED') {
      const [s, e] = booking.timeSlot.split('-');
      const hrs = Math.max(0, (toMin(e) - toMin(s)) / 60);
      const paidAmount = b.field.pricePerHour * hrs - (booking.discountAmount ?? 0);
      const pointsEarned = Math.floor(Math.max(0, paidAmount) / 10);

      if (pointsEarned > 0) {
        await tx.user.update({ where: { id: b.userId }, data: { points: { increment: pointsEarned } } });
        await tx.pointTransaction.create({
          data: { userId: b.userId, points: pointsEarned, type: 'EARN', bookingId: id, note: `จากการจอง ${b.field.name}` },
        });
        await tx.booking.update({ where: { id }, data: { pointsEarned } });
      }

      // Referral bonus on user's first approved booking
      const prevApproved = await tx.booking.count({
        where: { userId: b.userId, status: 'APPROVED', id: { not: id } },
      });
      if (prevApproved === 0 && b.user.referredById) {
        const referrerId = b.user.referredById;
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
    } else if (status === 'REJECTED' || status === 'CANCELLED') {
      // Restore redeemed points
      if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
        await tx.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } });
        await tx.pointTransaction.create({
          data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId: id, note: 'คืนแต้มเนื่องจากการยกเลิก/ปฏิเสธการจอง' },
        });
      }
      // Deduct earned points (if previously approved)
      if (booking.pointsEarned && booking.pointsEarned > 0) {
        await tx.user.update({ where: { id: booking.userId }, data: { points: { decrement: booking.pointsEarned } } });
        await tx.pointTransaction.create({
          data: { userId: booking.userId, points: -booking.pointsEarned, type: 'REDEEM', bookingId: id, note: 'หักแต้มเนื่องจากการยกเลิก/ปฏิเสธการจอง' },
        });
      }
      // Revert coupon usage count
      if (booking.couponCode) {
        await tx.coupon.update({
          where: { code: booking.couponCode },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }

    return b;
  });

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
    if (updated.user.notifLine) notifTasks.push(notifyLineBookingStatus('APPROVED', emailData).catch(() => {}));
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
    if (updated.user.notifLine) notifTasks.push(notifyLineBookingStatus('REJECTED', emailData).catch(() => {}));
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
      if (stripeEnabled) notifTasks.push(stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId }).catch(() => {}));
    }
  } else if (status === 'CANCELLED') {
    if (updated.user.notifEmail) notifTasks.push(sendBookingCancelledEmail(updated.user.email, emailData).catch(() => {}));
    if (booking.paidAt && booking.stripePaymentIntentId) {
      const stripeEnabled = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your');
      if (stripeEnabled) notifTasks.push(stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId }).catch(() => {}));
    }
  }

  if (notifTasks.length > 0) await Promise.allSettled(notifTasks);

  if (status === 'CANCELLED' || status === 'REJECTED') {
    notifyWaitingList(booking.fieldId, booking.date, booking.timeSlot).catch(() => {});
  }

  return NextResponse.json(updated);
}
