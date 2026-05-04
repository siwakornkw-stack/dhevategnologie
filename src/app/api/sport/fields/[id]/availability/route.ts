import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expandTimeSlot } from '@/lib/booking';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  const field = await prisma.field.findFirst({ where: { id: decodedId } });
  if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

  // Check if the date is blocked by admin
  const blocked = await prisma.fieldBlockedDate.findFirst({
    where: { fieldId: decodedId, date: dateObj },
  });
  if (blocked) {
    return NextResponse.json({
      bookedSlots: {},
      openTime: field.openTime,
      closeTime: field.closeTime,
      isBlocked: true,
      blockedReason: blocked.reason,
    });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      fieldId: decodedId,
      date: dateObj,
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { timeSlot: true, status: true },
  });

  const bookedSlots: Record<string, string> = {};
  for (const b of bookings) {
    for (const slot of expandTimeSlot(b.timeSlot)) {
      bookedSlots[slot] = b.status;
    }
  }

  return NextResponse.json({ bookedSlots, openTime: field.openTime, closeTime: field.closeTime, isBlocked: false });
}
