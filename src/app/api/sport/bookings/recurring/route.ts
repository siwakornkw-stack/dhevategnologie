import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';
import { expandTimeSlot } from '@/lib/booking';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`recurring:${session.user.id}`, BOOKING_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณจองบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });

  const { fieldId, startDate, timeSlot, weeks, note } = await req.json();

  if (!fieldId || !startDate || !timeSlot || !weeks) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const fieldExists = await prisma.field.findUnique({ where: { id: fieldId, isActive: true }, select: { id: true } });
  if (!fieldExists) return NextResponse.json({ error: 'ไม่พบสนามหรือสนามปิดให้บริการ' }, { status: 404 });

  const startDateObj = new Date(startDate);
  if (isNaN(startDateObj.getTime())) {
    return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
  }

  const numWeeks = Math.min(Math.max(parseInt(weeks, 10), 1), 52);
  const groupId = `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const bookings = [];
  const errors = [];

  const incomingSlots = expandTimeSlot(timeSlot);

  for (let i = 0; i < numWeeks; i++) {
    const d = new Date(startDateObj);
    d.setUTCDate(d.getUTCDate() + i * 7);

    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.booking.findMany({
            where: { fieldId, date: d, status: { in: ['PENDING', 'APPROVED'] } },
            select: { timeSlot: true },
          });
          const takenSlots = new Set(existing.flatMap((b) => expandTimeSlot(b.timeSlot)));
          if (incomingSlots.some((s) => takenSlots.has(s))) {
            throw Object.assign(new Error('conflict'), { isConflict: true });
          }
          return tx.booking.create({
            data: {
              userId: session.user.id,
              fieldId,
              date: d,
              timeSlot,
              note,
              isRecurring: true,
              recurringGroupId: groupId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      bookings.push(booking);
    } catch {
      errors.push(d.toLocaleDateString('th-TH'));
    }
  }

  // Auto-approve when Stripe is not configured (dev/test mode)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (bookings.length > 0 && (!stripeKey || stripeKey.startsWith('sk_test_your'))) {
    await prisma.booking.updateMany({
      where: { id: { in: bookings.map((b) => b.id) } },
      data: { status: 'APPROVED' },
    });
  }

  const status = bookings.length === 0 ? 409 : errors.length === 0 ? 201 : 200;
  return NextResponse.json({ bookings, errors, groupId }, { status });
}
