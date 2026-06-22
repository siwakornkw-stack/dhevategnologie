import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expandTimeSlot } from '@/lib/booking';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`availability:${ip}`, { limit: 60, windowMs: 60 * 1000 });
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { id: decodedId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  const field = await prisma.field.findFirst({
    where: { id: decodedId, deletedAt: null },
    include: { priceRules: { orderBy: { startTime: 'asc' } } },
  });
  if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

  const priceRules = field.priceRules.map((r) => ({
    startTime: r.startTime,
    endTime: r.endTime,
    pricePerHour: r.pricePerHour,
    label: r.label,
  }));

  // Check if the date is blocked by admin. A whole-day block (no time window) closes the
  // day; a time-window block only marks its slots as unavailable.
  const blocked = await prisma.fieldBlockedDate.findFirst({
    where: { fieldId: decodedId, date: dateObj },
  });
  if (blocked && (!blocked.startTime || !blocked.endTime)) {
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

  const bookedSlots: Record<string, string> = {};
  for (const b of bookings) {
    for (const slot of expandTimeSlot(b.timeSlot)) {
      bookedSlots[slot] = b.status;
    }
  }
  // Time-window block: mark its slots unavailable (does not override real bookings above).
  if (blocked && blocked.startTime && blocked.endTime) {
    for (const slot of expandTimeSlot(`${blocked.startTime}-${blocked.endTime}`)) {
      if (!bookedSlots[slot]) bookedSlots[slot] = 'BLOCKED';
    }
  }

  return NextResponse.json({ bookedSlots, openTime: field.openTime, closeTime: field.closeTime, priceRules, isBlocked: false });
}
