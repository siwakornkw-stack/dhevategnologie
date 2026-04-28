import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { sendBookingApprovedEmail, sendBookingRejectedEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';

const REFERRAL_BONUS = 50;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ids, status } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0 || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const bookings = await prisma.booking.findMany({
    where: { id: { in: ids }, status: 'PENDING' },
    include: {
      user: { select: { name: true, email: true, notifEmail: true, notifInApp: true, referredById: true } },
      field: { select: { name: true, pricePerHour: true } },
    },
  });

  if (bookings.length === 0) return NextResponse.json({ updated: 0 });

  await prisma.booking.updateMany({
    where: { id: { in: bookings.map((b) => b.id) } },
    data: { status },
  });

  if (status === 'APPROVED') {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

    // Check which users have prior approved bookings (for referral bonus)
    const userIds = [...new Set(bookings.map((b) => b.userId))];
    const usersWithPrior = await prisma.booking.findMany({
      where: { userId: { in: userIds }, status: 'APPROVED', id: { notIn: bookings.map((b) => b.id) } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const priorApprovedSet = new Set(usersWithPrior.map((b) => b.userId));
    // Track which users already got referral bonus in this batch
    const referralGivenTo = new Set<string>();

    await Promise.all(
      bookings.map(async (booking) => {
        const [s, e] = booking.timeSlot.split('-');
        const hrs = Math.max(0.5, (toMin(e) - toMin(s)) / 60);
        const paidAmount = Math.max(0, booking.field.pricePerHour * hrs - (booking.discountAmount ?? 0));
        const pointsEarned = Math.floor(paidAmount / 10);

        const tasks: Promise<unknown>[] = [];

        // Notification + email
        const emailData = {
          userName: booking.user.name ?? 'ลูกค้า',
          fieldName: booking.field.name,
          date: booking.date.toLocaleDateString('th-TH'),
          timeSlot: booking.timeSlot,
        };
        if (booking.user.notifEmail) tasks.push(sendBookingApprovedEmail(booking.user.email, emailData).catch(() => {}));
        if (booking.user.notifInApp) {
          tasks.push(
            prisma.notification.create({
              data: {
                userId: booking.userId,
                type: 'BOOKING_APPROVED',
                title: '🎉 การจองได้รับการอนุมัติ',
                message: `${booking.field.name} · ${emailData.date} เวลา ${booking.timeSlot} น.`,
                link: '/sport/bookings',
              },
            }).catch(() => {}),
            sendPushToUser(booking.userId, {
              title: '🎉 การจองได้รับการอนุมัติ',
              message: `${booking.field.name} · ${emailData.date} เวลา ${booking.timeSlot} น.`,
              link: '/sport/bookings',
            }).catch(() => {}),
          );
        }

        // Award points
        if (pointsEarned > 0) {
          tasks.push(
            prisma.user.update({ where: { id: booking.userId }, data: { points: { increment: pointsEarned } } }),
            prisma.pointTransaction.create({
              data: { userId: booking.userId, points: pointsEarned, type: 'EARN', bookingId: booking.id, note: `จากการจอง ${booking.field.name}` },
            }),
            prisma.booking.update({ where: { id: booking.id }, data: { pointsEarned } }),
          );
        }

        // Referral bonus on first approved booking
        const isFirstApproved = !priorApprovedSet.has(booking.userId) && booking.user.referredById && !referralGivenTo.has(booking.userId);
        if (isFirstApproved && booking.user.referredById) {
          referralGivenTo.add(booking.userId);
          const referrerId = booking.user.referredById;
          tasks.push(
            prisma.user.update({ where: { id: referrerId }, data: { points: { increment: REFERRAL_BONUS } } }),
            prisma.pointTransaction.create({
              data: { userId: referrerId, points: REFERRAL_BONUS, type: 'EARN', note: 'โบนัสแนะนำเพื่อน' },
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
      })
    );
  } else {
    // REJECTED — send notifications and refund if paid
    const stripeEnabled = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your');

    await Promise.all(
      bookings.map(async (booking) => {
        const emailData = {
          userName: booking.user.name ?? 'ลูกค้า',
          fieldName: booking.field.name,
          date: booking.date.toLocaleDateString('th-TH'),
          timeSlot: booking.timeSlot,
        };

        const tasks: Promise<unknown>[] = [];

        if (booking.user.notifEmail) tasks.push(sendBookingRejectedEmail(booking.user.email, emailData).catch(() => {}));
        if (booking.user.notifInApp) {
          tasks.push(
            prisma.notification.create({
              data: {
                userId: booking.userId,
                type: 'BOOKING_REJECTED',
                title: '❌ การจองถูกปฏิเสธ',
                message: `${booking.field.name} วันที่ ${emailData.date} เวลา ${booking.timeSlot} น.`,
                link: '/sport/bookings',
              },
            }).catch(() => {}),
            sendPushToUser(booking.userId, {
              title: '❌ การจองถูกปฏิเสธ',
              message: `${booking.field.name} · ${emailData.date}`,
              link: '/sport/bookings',
            }).catch(() => {}),
          );
        }

        if (stripeEnabled && booking.paidAt && booking.stripePaymentIntentId) {
          tasks.push(stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId }).catch(() => {}));
        }

        await Promise.allSettled(tasks);
      })
    );
  }

  return NextResponse.json({ updated: bookings.length });
}
