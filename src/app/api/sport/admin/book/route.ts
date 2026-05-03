import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function parseSlot(ts: string): [number, number] | null {
  const parts = ts.split('-');
  if (parts.length !== 2) return null;
  const s = toMinutes(parts[0]);
  const e = toMinutes(parts[1]);
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  return [s, e];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fieldId, date, timeSlot, note } = await req.json();

  if (!fieldId || !date || !timeSlot) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const incoming = parseSlot(timeSlot);
  if (!incoming) {
    return NextResponse.json({ error: 'รูปแบบช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
  }
  const [newStart, newEnd] = incoming;

  if (newEnd - newStart < 30) {
    return NextResponse.json({ error: 'ระยะเวลาขั้นต่ำ 30 นาที' }, { status: 400 });
  }

  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);

  if (bookingDate < today || bookingDate > maxDate) {
    return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
  }

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: { id: true, openTime: true, closeTime: true },
  });
  if (!field) return NextResponse.json({ error: 'ไม่พบสนาม' }, { status: 404 });

  const fieldOpen = toMinutes(field.openTime);
  const fieldClose = toMinutes(field.closeTime);
  if (newStart < fieldOpen || newEnd > fieldClose) {
    return NextResponse.json(
      { error: `เวลาต้องอยู่ในช่วง ${field.openTime}–${field.closeTime} น.` },
      { status: 400 }
    );
  }

  // Conflict check: interval overlap with any active booking
  const existingBookings = await prisma.booking.findMany({
    where: { fieldId, date: bookingDate, status: { in: ['PENDING', 'APPROVED'] } },
    select: { timeSlot: true },
  });

  const hasConflict = existingBookings.some((b) => {
    const parsed = parseSlot(b.timeSlot);
    if (!parsed) return false;
    const [existStart, existEnd] = parsed;
    return newStart < existEnd && newEnd > existStart;
  });

  if (hasConflict) {
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
