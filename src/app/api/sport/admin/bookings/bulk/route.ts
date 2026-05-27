import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { sendBookingApprovedEmail, sendBookingRejectedEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';
import { notifyLineBulkStatus } from '@/lib/line-notify';
import { calculatePriceWithRules } from '@/lib/booking';

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
      field: {
        select: {
          name: true,
          pricePerHour: true,
          priceRules: { select: { startTime: true, endTime: true, pricePerHour: true } },
        },
      },
    },
  });

  if (bookings.length === 0) return NextResponse.json({ updated: 0 });

  const upd = await prisma.booking.updateMany({
    where: { id: { in: bookings.map((b) => b.id) }, status: 'PENDING' },
    data: { status },
  });
  if (upd.count === 0) return NextResponse.json({ updated: 0 });

  if (status === 'APPROVED') {
    prisma.auditLog.create({
      data: { adminId: session.user.id, action: 'BOOKINGS_APPROVED', details: { ids: bookings.map((b) => b.id) } },
    }).catch(() => {});

    await Promise.all(
      bookings.map(async (booking) => {
        const [s, e] = booking.timeSlot.split('-');
        const base = calculatePriceWithRules(s, e, booking.field.pricePerHour, booking.field.priceRules || []);
        const paidAmount = Math.max(0, base - (booking.discountAmount ?? 0));
        const pointsEarned = Math.floor(paidAmount / 10);

        // Points award + referral bonus must be atomic so partial failures roll back.
        try {
          await prisma.$transaction(async (tx) => {
            if (pointsEarned > 0) {
              // Atomic claim: only award if pointsEarned not already set on this booking.
              // Protects against double-award when two admins overlap on the same booking IDs.
              const claimed = await tx.booking.updateMany({
                where: { id: booking.id, pointsEarned: null },
                data: { pointsEarned },
              });
              if (claimed.count === 1) {
                await tx.user.update({ where: { id: booking.userId }, data: { points: { increment: pointsEarned } } });
                await tx.pointTransaction.create({
                  data: { userId: booking.userId, points: pointsEarned, type: 'EARN', bookingId: booking.id, note: `จากการจอง ${booking.field.name}` },
                });
              }
            }

            // Referral bonus: atomic claim via updateMany guard on referralBonusGrantedAt.
            if (booking.user.referredById) {
              const referrerId = booking.user.referredById;
              const claimed = await tx.user.updateMany({
                where: { id: booking.userId, referralBonusGrantedAt: null },
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
                await tx.auditLog.create({
                  data: {
                    adminId: session.user.id,
                    action: 'REFERRAL_BONUS_AWARDED',
                    targetId: referrerId,
                    details: { referredUserId: booking.userId, points: REFERRAL_BONUS, bookingId: booking.id },
                  },
                });
              }
            }
          });
        } catch (err) {
          console.error('[bulk approve] points/referral tx failed:', { bookingId: booking.id, err });
        }

        // Post-tx notifications (fire-and-forget)
        const emailData = {
          userName: booking.user.name ?? 'ลูกค้า',
          fieldName: booking.field.name,
          date: booking.date.toLocaleDateString('th-TH'),
          timeSlot: booking.timeSlot,
        };
        const tasks: Promise<unknown>[] = [];
        if (booking.user.notifEmail) tasks.push(sendBookingApprovedEmail(booking.user.email, emailData).catch(() => {}));
        if (booking.user.notifInApp) {
          tasks.push(
            prisma.notification.create({
              data: {
                userId: booking.userId,
                type: 'BOOKING_APPROVED',
                title: 'การจองได้รับการอนุมัติ',
                message: `${booking.field.name} · ${emailData.date} เวลา ${booking.timeSlot} น.`,
                link: '/sport/bookings',
              },
            }).catch(() => {}),
            sendPushToUser(booking.userId, {
              title: 'การจองได้รับการอนุมัติ',
              message: `${booking.field.name} · ${emailData.date} เวลา ${booking.timeSlot} น.`,
              link: '/sport/bookings',
            }).catch(() => {}),
          );
        }
        await Promise.allSettled(tasks);
      })
    );
    notifyLineBulkStatus('APPROVED', bookings.length).catch(() => {});
  } else {
    // REJECTED — send notifications and refund if paid
    prisma.auditLog.create({
      data: { adminId: session.user.id, action: 'BOOKINGS_REJECTED', details: { ids: bookings.map((b) => b.id) } },
    }).catch(() => {});
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

        if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
          tasks.push(
            prisma.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } }),
            prisma.pointTransaction.create({
              data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId: booking.id, note: 'คืนแต้มเนื่องจากการจองถูกปฏิเสธ' },
            }),
          );
        }
        if (booking.couponCode) {
          tasks.push(
            prisma.coupon.update({ where: { code: booking.couponCode }, data: { usedCount: { decrement: 1 } } }).catch(() => {}),
          );
        }

        await Promise.allSettled(tasks);
      })
    );
    notifyLineBulkStatus('REJECTED', bookings.length).catch(() => {});
  }

  return NextResponse.json({ updated: bookings.length });
}
