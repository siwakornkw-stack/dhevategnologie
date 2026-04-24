import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = rateLimit(`recurring:${session.user.id}`, BOOKING_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณจองบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });

  const { fieldId, startDate, timeSlot, weeks, note } = await req.json();

  if (!fieldId || !startDate || !timeSlot || !weeks) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const numWeeks = Math.min(Math.max(parseInt(weeks, 10), 1), 8);
  const groupId = `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const bookings = [];
  const errors = [];

  for (let i = 0; i < numWeeks; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 7);

    try {
      const booking = await prisma.booking.create({
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
      bookings.push(booking);
    } catch {
      errors.push(d.toLocaleDateString('th-TH'));
    }
  }

  return NextResponse.json(
    { bookings, errors, groupId },
    { status: bookings.length > 0 ? 201 : 409 },
  );
}
