import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { sendBookingPaidEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
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
        select: { couponCode: true, status: true },
      });
      // updateMany won't throw if booking was already cleaned up
      await prisma.booking.updateMany({
        where: { id: bookingId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (booking?.status === 'PENDING' && booking.couponCode) {
        await prisma.coupon.update({
          where: { code: booking.couponCode },
          data: { usedCount: { decrement: 1 } },
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
