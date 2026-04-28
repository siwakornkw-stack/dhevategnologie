import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';
import { expandTimeSlot, calculateCouponDiscount, isCouponUsable } from '@/lib/booking';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit(`booking:${session.user.id}:${ip}`, BOOKING_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
  }

  const { fieldId, date, timeSlots, note, couponCode, redeemPoints } = await req.json();

  const slotsArray: string[] = Array.isArray(timeSlots) ? timeSlots : (timeSlots ? [timeSlots] : []);

  if (!fieldId || !date || slotsArray.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);

  if (bookingDate < today || bookingDate > maxDate) {
    return NextResponse.json({ error: 'สามารถจองได้ล่วงหน้าสูงสุด 1 ปี' }, { status: 400 });
  }

  const [field, user] = await Promise.all([
    prisma.field.findUnique({ where: { id: fieldId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { points: true } }),
  ]);
  if (!field) return NextResponse.json({ error: 'ไม่พบสนาม' }, { status: 404 });

  // Check slot conflicts — expand both existing and incoming slots to hourly blocks
  const existingBookings = await prisma.booking.findMany({
    where: { fieldId, date: bookingDate, status: { in: ['PENDING', 'APPROVED'] } },
    select: { timeSlot: true },
  });
  const takenSlots = new Set(existingBookings.flatMap((b) => expandTimeSlot(b.timeSlot)));
  const incomingSlots = slotsArray.flatMap((s) => expandTimeSlot(s));
  if (incomingSlots.some((s) => takenSlots.has(s))) {
    return NextResponse.json({ error: 'ช่วงเวลานี้ถูกจองแล้ว' }, { status: 409 });
  }

  // Validate coupon
  let appliedCoupon: { code: string; discountType: string; discountValue: number } | null = null;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    if (coupon && isCouponUsable(coupon)) {
      appliedCoupon = { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue };
    }
  }

  const startTime = slotsArray[0].split('-')[0];
  const endTime = slotsArray[slotsArray.length - 1].split('-')[1];
  const timeSlotRange = slotsArray.length === 1 ? slotsArray[0] : `${startTime}-${endTime}`;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hours = (toMin(endTime) - toMin(startTime)) / 60;
  const baseAmount = field.pricePerHour * hours;

  const couponDiscount = calculateCouponDiscount(appliedCoupon, baseAmount);

  // Loyalty points redemption: 100 points = 10 THB
  const userPoints = user?.points ?? 0;
  const pointsToRedeem = redeemPoints && userPoints >= 100
    ? Math.min(Math.floor((baseAmount - couponDiscount) / 10) * 100, userPoints)
    : 0;
  const pointsDiscount = Math.floor(pointsToRedeem / 100) * 10;

  const discountAmount = couponDiscount + pointsDiscount;
  const totalAmount = Math.max(0, baseAmount - discountAmount);

  // Create booking
  let booking;
  try {
    booking = await prisma.booking.create({
      data: {
        userId: session.user.id, fieldId, date: bookingDate, timeSlot: timeSlotRange, note,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code, discountAmount } : { discountAmount: discountAmount || undefined }),
        ...(pointsToRedeem > 0 ? { pointsRedeemed: pointsToRedeem } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'ช่วงเวลานี้ถูกจองแล้ว' }, { status: 409 });
  }

  // Deduct redeemed points immediately
  if (pointsToRedeem > 0) {
    await Promise.all([
      prisma.user.update({ where: { id: session.user.id }, data: { points: { decrement: pointsToRedeem } } }),
      prisma.pointTransaction.create({
        data: { userId: session.user.id, points: -pointsToRedeem, type: 'REDEEM', bookingId: booking.id, note: `แลกแต้มสำหรับการจอง ${timeSlotRange}` },
      }),
    ]);
  }

  if (appliedCoupon) {
    await prisma.coupon.update({ where: { code: appliedCoupon.code }, data: { usedCount: { increment: 1 } } });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeEnabled = stripeKey && !stripeKey.startsWith('sk_test_your');

  if (!stripeEnabled) {
    return NextResponse.json({ url: '/sport/bookings', skipPayment: true });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  try {
    const desc = [
      `วันที่ ${new Date(date).toLocaleDateString('th-TH')} เวลา ${timeSlotRange} น. (${hours} ชม.)`,
      appliedCoupon ? `ส่วนลด ${appliedCoupon.code}` : '',
      pointsToRedeem > 0 ? `แลก ${pointsToRedeem} แต้ม (-฿${pointsDiscount})` : '',
    ].filter(Boolean).join(' · ');

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'promptpay'],
      line_items: [{
        price_data: {
          currency: 'thb',
          product_data: { name: `จองสนาม: ${field.name}`, description: desc },
          unit_amount: Math.round(totalAmount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/sport/payment/success?bookingId=${booking.id}`,
      cancel_url: `${baseUrl}/sport/payment/cancel?bookingId=${booking.id}`,
      metadata: { bookingId: booking.id, userId: session.user.id },
    });

    await prisma.booking.update({ where: { id: booking.id }, data: { stripeSessionId: checkoutSession.id } });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
    const message = err instanceof Error ? err.message : 'Stripe error';
    return NextResponse.json({ error: `ระบบชำระเงินมีปัญหา: ${message}` }, { status: 502 });
  }
}
