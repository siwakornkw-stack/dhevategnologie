import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { expandTimeSlot } from '@/lib/booking';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fieldId, date, timeSlot, note } = await req.json();

  if (!fieldId || !date || !timeSlot) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);

  if (bookingDate < today || bookingDate > maxDate) {
    return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
  }

  const fieldExists = await prisma.field.findUnique({ where: { id: fieldId }, select: { id: true } });
  if (!fieldExists) return NextResponse.json({ error: 'ไม่พบสนาม' }, { status: 404 });

  // Conflict check using expanded hourly slots
  const existingBookings = await prisma.booking.findMany({
    where: { fieldId, date: bookingDate, status: { in: ['PENDING', 'APPROVED'] } },
    select: { timeSlot: true },
  });
  const takenSlots = new Set(existingBookings.flatMap((b) => expandTimeSlot(b.timeSlot)));
  const incomingSlots = expandTimeSlot(timeSlot);
  if (incomingSlots.some((s) => takenSlots.has(s))) {
    return NextResponse.json({ error: 'ช่วงเวลานี้ถูกจองแล้ว' }, { status: 409 });
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        userId: session.user.id,
        fieldId,
        date: bookingDate,
        timeSlot,
        note: note || null,
        status: 'APPROVED',
      },
      include: {
        field: { select: { name: true } },
      },
    });
    return NextResponse.json(booking, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'ช่วงเวลานี้ถูกจองแล้ว' }, { status: 409 });
  }
}
