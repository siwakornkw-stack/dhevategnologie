import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';
import { expandTimeSlot, calculateCouponDiscount, isCouponUsable } from '@/lib/booking';
import { sendBookingCreatedEmail } from '@/lib/email';
import { notifyLineNewBooking } from '@/lib/line-notify';
import { sendPushToUser } from '@/lib/web-push';

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
    prisma.field.findUnique({ where: { id: fieldId, isActive: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { points: true, name: true, email: true } }),
  ]);
  if (!field) return NextResponse.json({ error: 'ไม่พบสนามหรือสนามปิดให้บริการ' }, { status: 404 });

  // Validate coupon
  let appliedCoupon: { code: string; discountType: string; discountValue: number } | null = null;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    if (coupon && isCouponUsable(coupon)) {
      appliedCoupon = { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue };
    }
  }

  const slotFmt = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  if (slotsArray.some((s) => !slotFmt.test(s))) {
    return NextResponse.json({ error: 'รูปแบบช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
  }

  const startTime = slotsArray[0].split('-')[0];
  const endTime = slotsArray[slotsArray.length - 1].split('-')[1];
  const timeSlotRange = slotsArray.length === 1 ? slotsArray[0] : `${startTime}-${endTime}`;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hours = (toMin(endTime) - toMin(startTime)) / 60;
  if (hours <= 0 || isNaN(hours)) {
    return NextResponse.json({ error: 'ช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
  }
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

  // Conflict check + booking create inside a transaction to prevent race conditions
  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      const existingBookings = await tx.booking.findMany({
        where: { fieldId, date: bookingDate, status: { in: ['PENDING', 'APPROVED'] } },
        select: { timeSlot: true, userId: true },
      });
      // Prevent duplicate booking from same user (double-click / concurrent submit)
      if (existingBookings.some((b) => b.userId === session.user.id)) {
        throw Object.assign(new Error('DUPLICATE'), { isDuplicate: true });
      }
      const takenSlots = new Set(existingBookings.flatMap((b) => expandTimeSlot(b.timeSlot)));
      const incomingSlots = slotsArray.flatMap((s) => expandTimeSlot(s));
      if (incomingSlots.some((s) => takenSlots.has(s))) {
        throw Object.assign(new Error('CONFLICT'), { isConflict: true });
      }
      if (appliedCoupon) {
        const updated = await tx.$executeRaw`
          UPDATE "Coupon" SET "usedCount" = "usedCount" + 1
          WHERE code = ${appliedCoupon.code} AND "isActive" = true
          AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        `;
        if (updated === 0) {
          throw Object.assign(new Error('COUPON_INVALID'), { isCouponInvalid: true });
        }
      }
      return tx.booking.create({
        data: {
          userId: session.user.id, fieldId, date: bookingDate, timeSlot: timeSlotRange, note,
          ...(appliedCoupon ? { couponCode: appliedCoupon.code, discountAmount } : { discountAmount: discountAmount || undefined }),
          ...(pointsToRedeem > 0 ? { pointsRedeemed: pointsToRedeem } : {}),
        },
      });
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'isCouponInvalid' in e) {
      return NextResponse.json({ error: 'คูปองนี้ไม่สามารถใช้ได้หรือหมดอายุแล้ว' }, { status: 400 });
    }
    if (e && typeof e === 'object' && 'isDuplicate' in e) {
      return NextResponse.json({ error: 'คุณมีการจองที่รอดำเนินการสำหรับช่วงเวลานี้อยู่แล้ว' }, { status: 409 });
    }
    return NextResponse.json({ error: 'ช่วงเวลานี้ถูกจองแล้ว' }, { status: 409 });
  }

  // Deduct redeemed points and increment coupon usage after booking is confirmed
  const sideEffects: Promise<unknown>[] = [];
  if (pointsToRedeem > 0) {
    sideEffects.push(
      prisma.user.update({ where: { id: session.user.id }, data: { points: { decrement: pointsToRedeem } } }),
      prisma.pointTransaction.create({
        data: { userId: session.user.id, points: -pointsToRedeem, type: 'REDEEM', bookingId: booking.id, note: `แลกแต้มสำหรับการจอง ${timeSlotRange}` },
      }),
    );
  }
  if (sideEffects.length > 0) await Promise.all(sideEffects);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeEnabled = stripeKey && !stripeKey.startsWith('sk_test_your');

  // Notify admins of new booking (fire-and-forget)
  const fieldName = field.name;
  async function notifyAdmins() {
    const bookingInfo = {
      userName: user?.name ?? 'ลูกค้า',
      fieldName,
      date: new Date(date).toLocaleDateString('th-TH'),
      timeSlot: timeSlotRange,
    };
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, notifInApp: true },
    });
    const tasks: Promise<unknown>[] = [
      notifyLineNewBooking(bookingInfo).catch(() => {}),
    ];
    for (const admin of admins) {
      if (admin.notifInApp) {
        tasks.push(
          prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'NEW_BOOKING',
              title: 'การจองใหม่',
              message: `${bookingInfo.userName} จอง ${fieldName} · ${bookingInfo.date} เวลา ${timeSlotRange} น.`,
              link: '/sport/admin/bookings',
            },
          }).catch(() => {}),
          sendPushToUser(admin.id, {
            title: 'การจองใหม่',
            message: `${bookingInfo.userName} จอง ${fieldName} · ${timeSlotRange} น.`,
            link: '/sport/admin/bookings',
          }).catch(() => {}),
        );
      }
    }
    await Promise.allSettled(tasks);
  }

  if (!stripeEnabled || totalAmount === 0) {
    if (user?.email) {
      sendBookingCreatedEmail(user.email, {
        userName: user.name ?? 'ลูกค้า',
        fieldName: field.name,
        date: new Date(date).toLocaleDateString('th-TH'),
        timeSlot: timeSlotRange,
        amountPaid: totalAmount,
        discountAmount: discountAmount || undefined,
      }).catch(() => {});
    }
    notifyAdmins().catch(() => {});
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
    if (user?.email) {
      sendBookingCreatedEmail(user.email, {
        userName: user.name ?? 'ลูกค้า',
        fieldName: field.name,
        date: new Date(date).toLocaleDateString('th-TH'),
        timeSlot: timeSlotRange,
        discountAmount: discountAmount || undefined,
      }).catch(() => {});
    }
    notifyAdmins().catch(() => {});
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    // Rollback booking, restore points, and undo coupon usage
    const rollback: Promise<unknown>[] = [
      prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } }),
    ];
    if (pointsToRedeem > 0) {
      rollback.push(
        prisma.user.update({ where: { id: session.user.id }, data: { points: { increment: pointsToRedeem } } }),
        prisma.pointTransaction.create({
          data: { userId: session.user.id, points: pointsToRedeem, type: 'EARN', bookingId: booking.id, note: 'คืนแต้มเนื่องจากการชำระเงินล้มเหลว' },
        }),
      );
    }
    if (appliedCoupon) {
      rollback.push(
        prisma.coupon.update({ where: { code: appliedCoupon.code }, data: { usedCount: { decrement: 1 } } }),
      );
    }
    await Promise.allSettled(rollback);
    const message = err instanceof Error ? err.message : 'Stripe error';
    return NextResponse.json({ error: `ระบบชำระเงินมีปัญหา: ${message}` }, { status: 502 });
  }
}
