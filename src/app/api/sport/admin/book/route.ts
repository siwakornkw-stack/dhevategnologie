import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
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

  if (newEnd - newStart < 5) {
    return NextResponse.json({ error: 'ระยะเวลาขั้นต่ำ 5 นาที' }, { status: 400 });
  }

  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);

  if (isNaN(bookingDate.getTime()) || bookingDate < today || bookingDate > maxDate) {
    return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
  }

  const [field, blocked] = await Promise.all([
    prisma.field.findUnique({ where: { id: fieldId, isActive: true }, select: { id: true, openTime: true, closeTime: true } }),
    prisma.fieldBlockedDate.findFirst({ where: { fieldId, date: bookingDate } }),
  ]);
  if (!field) return NextResponse.json({ error: 'ไม่พบสนาม' }, { status: 404 });
  if (blocked) return NextResponse.json({ error: `สนามปิดให้บริการในวันนี้${blocked.reason ? `: ${blocked.reason}` : ''}` }, { status: 409 });

  const fieldOpen = toMinutes(field.openTime);
  const fieldClose = toMinutes(field.closeTime);
  if (newStart < fieldOpen || newEnd > fieldClose) {
    return NextResponse.json(
      { error: `เวลาต้องอยู่ในช่วง ${field.openTime}–${field.closeTime} น.` },
      { status: 400 }
    );
  }

  try {
    // Serializable transaction: conflict check + insert are atomic.
    // Prevents race conditions where two concurrent requests both pass the check
    // and both proceed to create overlapping bookings.
    const booking = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.booking.findMany({
          where: { fieldId, date: bookingDate, status: { in: ['PENDING', 'APPROVED'] } },
          select: { timeSlot: true },
        });

        const conflict = existing.some((b) => {
          const p = parseSlot(b.timeSlot);
          return p ? overlaps(newStart, newEnd, p[0], p[1]) : false;
        });

        if (conflict) throw new Error('conflict');

        return tx.booking.create({
          data: {
            userId: session.user.id,
            fieldId,
            date: bookingDate,
            timeSlot,
            note: note || null,
            status: 'APPROVED',
          },
          include: { field: { select: { name: true } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error && err.message === 'conflict'
      ? 'ช่วงเวลานี้ถูกจองแล้ว'
      : 'ช่วงเวลานี้ถูกจองแล้ว';
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
