import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateTimeSlots, parseSlot, slotsOverlap } from '@/lib/booking';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: decodedId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  const field = await prisma.field.findFirst({
    where: { id: decodedId },
    include: { priceRules: { orderBy: { startTime: 'asc' } } },
  });
  if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

  const priceRules = field.priceRules.map((r) => ({
    startTime: r.startTime,
    endTime: r.endTime,
    pricePerHour: r.pricePerHour,
    label: r.label,
  }));

  // Check if the date is blocked by admin
  const blocked = await prisma.fieldBlockedDate.findFirst({
    where: { fieldId: decodedId, date: dateObj },
  });
  if (blocked) {
    return NextResponse.json({
      bookedSlots: {},
      openTime: field.openTime,
      closeTime: field.closeTime,
      priceRules,
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

  // Mark each hourly grid cell booked if any booking overlaps it (interval overlap,
  // so non-hour-aligned bookings like 08:30-09:30 correctly block 08:00-09:00 and 09:00-10:00).
  const parsedBookings: { range: [number, number]; status: string }[] = [];
  for (const b of bookings) {
    const range = parseSlot(b.timeSlot);
    if (range) parsedBookings.push({ range, status: b.status });
  }
  const bookedSlots: Record<string, string> = {};
  for (const slot of generateTimeSlots(field.openTime, field.closeTime)) {
    const g = parseSlot(slot);
    if (!g) continue;
    const hit = parsedBookings.find((b) => slotsOverlap(g[0], g[1], b.range[0], b.range[1]));
    if (hit) bookedSlots[slot] = hit.status;
  }

  return NextResponse.json({ bookedSlots, openTime: field.openTime, closeTime: field.closeTime, priceRules, isBlocked: false });
}
