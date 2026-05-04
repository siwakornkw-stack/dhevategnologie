import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { sendBookingPaidEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) return NextResponse.json({ ok: true });

    let booking;
    try {
      booking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          paidAt: new Date(),
        },
        include: {
          user: { select: { name: true, email: true, notifEmail: true, notifInApp: true } },
          field: { select: { name: true, pricePerHour: true } },
        },
      });
    } catch {
      // Booking already cancelled (e.g. by cron cleanup) — acknowledge webhook to stop retries
      return NextResponse.json({ ok: true });
    }

    const amountPaid = session.amount_total ? session.amount_total / 100 : null;
    const discountAmount = booking.discountAmount ?? 0;

    const promises: Promise<unknown>[] = [];

    if (booking.user.notifEmail) {
      promises.push(
        sendBookingPaidEmail(booking.user.email, {
          userName: booking.user.name ?? 'ลูกค้า',
          fieldName: booking.field.name,
          date: booking.date.toLocaleDateString('th-TH'),
          timeSlot: booking.timeSlot,
          amountPaid: amountPaid ?? undefined,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
        }).catch(() => {}),
      );
    }

    if (booking.user.notifInApp) {
      promises.push(
        prisma.notification.create({
          data: {
            userId: booking.userId,
            type: 'PAYMENT_SUCCESS',
            title: '💳 ชำระเงินสำเร็จ',
            message: `ชำระเงินจอง ${booking.field.name} สำเร็จ${amountPaid ? ` ฿${amountPaid.toLocaleString()}` : ''} รอแอดมินอนุมัติ`,
            link: '/sport/bookings',
          },
        }).catch(() => {}),
        sendPushToUser(booking.userId, {
          title: '💳 ชำระเงินสำเร็จ',
          message: `จอง ${booking.field.name} สำเร็จ รอการอนุมัติ`,
          link: '/sport/bookings',
        }).catch(() => {}),
      );
    }

    await Promise.allSettled(promises);
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { couponCode: true, status: true, pointsRedeemed: true, userId: true },
      });
      await prisma.booking.updateMany({
        where: { id: bookingId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (booking?.status === 'PENDING') {
        const tasks: Promise<unknown>[] = [];
        if (booking.couponCode) {
          tasks.push(prisma.coupon.update({ where: { code: booking.couponCode }, data: { usedCount: { decrement: 1 } } }).catch(() => {}));
        }
        if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
          tasks.push(
            prisma.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } }),
            prisma.pointTransaction.create({
              data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId, note: 'คืนแต้มเนื่องจาก session หมดอายุ' },
            }),
          );
        }
        if (tasks.length > 0) await Promise.allSettled(tasks);
      }
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    if (paymentIntentId) {
      const booking = await prisma.booking.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { id: true, userId: true, couponCode: true, pointsRedeemed: true, status: true },
      });

      if (booking) {
        // Atomic status transition - prevents double-processing on concurrent webhooks
        const updated = await prisma.booking.updateMany({
          where: { id: booking.id, status: { not: 'CANCELLED' } },
          data: { status: 'CANCELLED' },
        });

        if (updated.count > 0) {
          const tasks: Promise<unknown>[] = [];
          if (booking.couponCode) {
            tasks.push(
              prisma.coupon.update({ where: { code: booking.couponCode }, data: { usedCount: { decrement: 1 } } }).catch(() => {}),
            );
          }
          if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
            tasks.push(
              prisma.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } }),
              prisma.pointTransaction.create({
                data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId: booking.id, note: 'คืนแต้มเนื่องจากการคืนเงิน' },
              }),
            );
          }
          if (tasks.length > 0) await Promise.allSettled(tasks);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
