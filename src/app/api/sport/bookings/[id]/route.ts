import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { BookingStatus } from '@prisma/client';
import { sendBookingApprovedEmail, sendBookingCancelledEmail, sendBookingRejectedEmail } from '@/lib/email';
import { notifyLineBookingStatus } from '@/lib/line-notify';
import { stripe } from '@/lib/stripe';
import { notifyWaitingList } from '@/lib/waiting-list-notify';
import { sendPushToUser } from '@/lib/web-push';

const REFERRAL_BONUS = 50; // points awarded to referrer

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

  const updated = await prisma.booking.update({
    where: { id },
    data: { status },
    include: {
      field: { select: { name: true, pricePerHour: true } },
      user: { select: { name: true, email: true, notifEmail: true, notifLine: true, notifInApp: true, referredById: true } },
    },
  });

  const emailData = {
    userName: updated.user.name ?? 'ลูกค้า',
    fieldName: updated.field.name,
    date: updated.date.toLocaleDateString('th-TH'),
    timeSlot: updated.timeSlot,
  };

  if (status === 'APPROVED') {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const [s, e] = booking.timeSlot.split('-');
    const hrs = Math.max(1, (toMin(e) - toMin(s)) / 60);
    const paidAmount = (updated.field.pricePerHour * hrs) - (booking.discountAmount ?? 0);
    const pointsEarned = Math.floor(Math.max(0, paidAmount) / 10);

    // Check if this is the user's first approved booking (for referral bonus)
    const prevApproved = await prisma.booking.count({
      where: { userId: updated.userId, status: 'APPROVED', id: { not: id } },
    });
    const isFirstApproved = prevApproved === 0 && updated.user.referredById;

    const tasks: Promise<unknown>[] = [];

    if (updated.user.notifEmail) tasks.push(sendBookingApprovedEmail(updated.user.email, emailData).catch(() => {}));
    if (updated.user.notifLine) tasks.push(notifyLineBookingStatus('APPROVED', emailData).catch(() => {}));
    if (updated.user.notifInApp) {
      tasks.push(
        prisma.notification.create({
          data: {
            userId: updated.userId,
            type: 'BOOKING_APPROVED',
            title: '🎉 การจองได้รับการอนุมัติ',
            message: `${updated.field.name} · ${emailData.date} เวลา ${updated.timeSlot} น.`,
            link: '/sport/bookings',
          },
        }).catch(() => {}),
      );
      tasks.push(sendPushToUser(updated.userId, {
        title: '🎉 การจองได้รับการอนุมัติ',
        message: `${updated.field.name} · ${emailData.date} เวลา ${updated.timeSlot} น.`,
        link: '/sport/bookings',
      }).catch(() => {}));
    }

    if (pointsEarned > 0) {
      tasks.push(
        prisma.user.update({ where: { id: updated.userId }, data: { points: { increment: pointsEarned } } }),
        prisma.pointTransaction.create({
          data: { userId: updated.userId, points: pointsEarned, type: 'EARN', bookingId: booking.id, note: `จากการจอง ${updated.field.name}` },
        }),
        prisma.booking.update({ where: { id: booking.id }, data: { pointsEarned } }),
      );
    }

    // Referral bonus on first booking
    if (isFirstApproved && updated.user.referredById) {
      const referrerId = updated.user.referredById;
      tasks.push(
        prisma.user.update({ where: { id: referrerId }, data: { points: { increment: REFERRAL_BONUS } } }),
        prisma.pointTransaction.create({
          data: { userId: referrerId, points: REFERRAL_BONUS, type: 'EARN', note: `โบนัสแนะนำเพื่อน` },
        }),
        prisma.notification.create({
          data: {
            userId: referrerId,
            type: 'REFERRAL_BONUS',
            title: '⭐ ได้รับโบนัสแนะนำเพื่อน',
            message: `คุณได้รับ ${REFERRAL_BONUS} แต้มจากการที่เพื่อนจองสนามครั้งแรก`,
            link: '/sport/profile',
          },
        }),
      );
    }

    await Promise.allSettled(tasks);
  } else if (status === 'REJECTED') {
    const tasks: Promise<unknown>[] = [];
    if (updated.user.notifEmail) tasks.push(sendBookingRejectedEmail(updated.user.email, emailData).catch(() => {}));
    if (updated.user.notifLine) tasks.push(notifyLineBookingStatus('REJECTED', emailData).catch(() => {}));
    if (updated.user.notifInApp) {
      tasks.push(
        prisma.notification.create({
          data: {
            userId: updated.userId,
            type: 'BOOKING_REJECTED',
            title: '❌ การจองถูกปฏิเสธ',
            message: `${updated.field.name} · ${emailData.date} เวลา ${updated.timeSlot} น.`,
            link: '/sport/bookings',
          },
        }).catch(() => {}),
      );
      tasks.push(sendPushToUser(updated.userId, {
        title: '❌ การจองถูกปฏิเสธ',
        message: `${updated.field.name} · ${emailData.date}`,
        link: '/sport/bookings',
      }).catch(() => {}));
    }

    if (booking.paidAt && booking.stripePaymentIntentId) {
      const stripeEnabled = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your');
      if (stripeEnabled) tasks.push(stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId }).catch(() => {}));
    }

    // Restore redeemed points
    if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
      tasks.push(
        prisma.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } }),
        prisma.pointTransaction.create({
          data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId: booking.id, note: 'คืนแต้มเนื่องจากการจองถูกปฏิเสธ' },
        }),
      );
    }
    // Deduct points earned on approval (if rejecting a previously approved booking)
    if (booking.pointsEarned && booking.pointsEarned > 0) {
      tasks.push(
        prisma.user.update({ where: { id: booking.userId }, data: { points: { decrement: booking.pointsEarned } } }),
        prisma.pointTransaction.create({
          data: { userId: booking.userId, points: -booking.pointsEarned, type: 'REDEEM', bookingId: booking.id, note: 'หักแต้มเนื่องจากการจองถูกปฏิเสธ' },
        }),
      );
    }
    if (booking.couponCode) {
      tasks.push(
        prisma.coupon.update({ where: { code: booking.couponCode }, data: { usedCount: { decrement: 1 } } }).catch(() => {}),
      );
    }

    await Promise.allSettled(tasks);
  } else if (status === 'CANCELLED') {
    const cancelTasks: Promise<unknown>[] = [];
    if (updated.user.notifEmail) {
      cancelTasks.push(sendBookingCancelledEmail(updated.user.email, emailData).catch(() => {}));
    }
    if (booking.paidAt && booking.stripePaymentIntentId) {
      const stripeEnabled = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your');
      if (stripeEnabled) cancelTasks.push(stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId }).catch(() => {}));
    }
    if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
      cancelTasks.push(
        prisma.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } }),
        prisma.pointTransaction.create({
          data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId: booking.id, note: 'คืนแต้มเนื่องจากการยกเลิกการจอง' },
        }),
      );
    }
    if (booking.couponCode) {
      cancelTasks.push(
        prisma.coupon.update({ where: { code: booking.couponCode }, data: { usedCount: { decrement: 1 } } }).catch(() => {}),
      );
    }
    // Deduct points earned on approval
    if (booking.pointsEarned && booking.pointsEarned > 0) {
      cancelTasks.push(
        prisma.user.update({ where: { id: booking.userId }, data: { points: { decrement: booking.pointsEarned } } }),
        prisma.pointTransaction.create({
          data: { userId: booking.userId, points: -booking.pointsEarned, type: 'REDEEM', bookingId: booking.id, note: 'หักแต้มเนื่องจากการยกเลิกการจอง' },
        }),
      );
    }
    if (cancelTasks.length > 0) await Promise.allSettled(cancelTasks);
  }

  if (status === 'CANCELLED' || status === 'REJECTED') {
    notifyWaitingList(booking.fieldId, booking.date, booking.timeSlot).catch(() => {});
  }

  return NextResponse.json(updated);
}
