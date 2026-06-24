import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { sendBookingPaidEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';

// Marks a booking paid + fires notifications. Idempotent via the paidAt:null guard,
// so it is safe to invoke from both checkout.session.completed (sync card) and
// checkout.session.async_payment_succeeded (PromptPay settles after the session completes).
async function markBookingPaid(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  const updateResult = await prisma.booking.updateMany({
    where: { id: bookingId, paidAt: null },
    data: {
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      paidAt: new Date(),
    },
  });
  if (updateResult.count === 0) return; // already processed or cancelled

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { name: true, email: true, notifEmail: true, notifInApp: true } },
      field: { select: { name: true, pricePerHour: true } },
    },
  });
  if (!booking) return;

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

  // Dedup against Stripe event.id. Stripe may redeliver the same event multiple times;
  // unique-PK insert fails atomically on the second delivery so handler side-effects
  // (refunds, point reversals, emails) only run once.
  try {
    await prisma.processedStripeEvent.create({ data: { eventId: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // For async methods (PromptPay) Stripe fires completed even when funds have not
    // settled. Only mark paid once payment_status is actually 'paid'; otherwise the
    // settlement arrives later via checkout.session.async_payment_succeeded.
    if (session.payment_status === 'paid') {
      await markBookingPaid(session);
    }
  }

  if (event.type === 'checkout.session.async_payment_succeeded') {
    // PromptPay/delayed methods settle here after the session already completed.
    await markBookingPaid(event.data.object);
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      // Single tx: status flip + coupon decrement + point restore must all-or-nothing,
      // otherwise a partial failure leaves the booking cancelled with stuck coupon usage.
      await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: { couponCode: true, status: true, pointsRedeemed: true, userId: true },
        });
        if (!booking) return;
        const expired = await tx.booking.updateMany({
          where: { id: bookingId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        if (expired.count === 0) return;
        if (booking.couponCode) {
          await tx.coupon.update({ where: { code: booking.couponCode }, data: { usedCount: { decrement: 1 } } });
        }
        if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
          await tx.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } });
          await tx.pointTransaction.create({
            data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId, note: 'คืนแต้มเนื่องจาก session หมดอายุ' },
          });
        }
      });
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    const fullyRefunded = charge.amount_refunded >= charge.amount;
    if (paymentIntentId && fullyRefunded) {
      const booking = await prisma.booking.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { id: true, userId: true, couponCode: true, pointsRedeemed: true, pointsEarned: true, status: true },
      });

      if (booking) {
        // Single tx: status flip + reversals must all-or-nothing.
        await prisma.$transaction(async (tx) => {
          // Skip REJECTED as well as CANCELLED: admin reject (bookings/[id] PUT and the bulk
          // route) already restores points + decrements coupon in-band BEFORE calling
          // stripe.refunds.create, so the resulting charge.refunded must not reverse a second
          // time. This guard only fires for refunds initiated outside the app (e.g. the Stripe
          // dashboard) where status is still APPROVED/PENDING and no in-band reversal ran.
          const updated = await tx.booking.updateMany({
            where: { id: booking.id, status: { notIn: ['CANCELLED', 'REJECTED'] } },
            data: { status: 'CANCELLED' },
          });
          if (updated.count === 0) return;
          if (booking.couponCode) {
            await tx.coupon.updateMany({ where: { code: booking.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
          }
          if (booking.pointsRedeemed && booking.pointsRedeemed > 0) {
            await tx.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsRedeemed } } });
            await tx.pointTransaction.create({
              data: { userId: booking.userId, points: booking.pointsRedeemed, type: 'EARN', bookingId: booking.id, note: 'คืนแต้มเนื่องจากการคืนเงิน' },
            });
          }
          // Deduct points earned on approval (clamp to current balance to avoid negative)
          if (booking.pointsEarned && booking.pointsEarned > 0) {
            const cur = await tx.user.findUnique({ where: { id: booking.userId }, select: { points: true } });
            const deduct = Math.min(booking.pointsEarned, cur?.points ?? 0);
            if (deduct > 0) {
              await tx.user.update({ where: { id: booking.userId }, data: { points: { decrement: deduct } } });
            }
            await tx.pointTransaction.create({
              data: { userId: booking.userId, points: -deduct, type: 'REDEEM', bookingId: booking.id, note: 'หักแต้มเนื่องจากการคืนเงิน' },
            });
          }
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
