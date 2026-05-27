import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';
import { hasSlotConflict } from '@/lib/booking';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`recurring:${session.user.id}`, BOOKING_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณจองบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });

  const { fieldId, startDate, timeSlot, weeks, note } = await req.json();

  if (!fieldId || !startDate || !timeSlot || !weeks) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const field = await prisma.field.findUnique({
    where: { id: fieldId, isActive: true },
    select: { id: true, openTime: true, closeTime: true },
  });
  if (!field) return NextResponse.json({ error: 'ไม่พบสนามหรือสนามปิดให้บริการ' }, { status: 404 });

  const startDateObj = new Date(startDate);
  if (isNaN(startDateObj.getTime())) {
    return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
  }

  // Validate timeSlot format and field operating hours
  const slotFmt = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  if (!slotFmt.test(timeSlot)) {
    return NextResponse.json({ error: 'รูปแบบช่วงเวลาไม่ถูกต้อง' }, { status: 400 });
  }
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const [slotStartStr, slotEndStr] = timeSlot.split('-');
  const fieldOpen = toMin(field.openTime);
  let fieldClose = toMin(field.closeTime);
  if (fieldClose <= fieldOpen) fieldClose += 1440;
  let slotStart = toMin(slotStartStr);
  let slotEnd = toMin(slotEndStr);
  if (slotEnd <= slotStart) slotEnd += 1440;
  if (slotStart < fieldOpen) { slotStart += 1440; slotEnd += 1440; }
  if (slotStart < fieldOpen || slotEnd > fieldClose) {
    return NextResponse.json(
      { error: `เวลาต้องอยู่ในช่วง ${field.openTime}–${field.closeTime} น.` },
      { status: 400 }
    );
  }

  const weeksParsed = parseInt(weeks, 10);
  if (!Number.isFinite(weeksParsed) || weeksParsed < 1) {
    return NextResponse.json({ error: 'จำนวนสัปดาห์ไม่ถูกต้อง' }, { status: 400 });
  }
  const numWeeks = Math.min(weeksParsed, 52);
  const groupId = `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const bookings = [];
  const errors = [];

  for (let i = 0; i < numWeeks; i++) {
    // Consume rate limit per booking iteration so bulk calls cannot bypass
    const iterRl = await rateLimit(`recurring:${session.user.id}`, BOOKING_RATE_LIMIT);
    if (!iterRl.success) {
      errors.push(`rate-limited at week ${i + 1}`);
      break;
    }

    const d = new Date(startDateObj);
    d.setUTCDate(d.getUTCDate() + i * 7);

    // Skip blocked dates
    const blocked = await prisma.fieldBlockedDate.findFirst({ where: { fieldId, date: d } });
    if (blocked) {
      errors.push(`${d.toLocaleDateString('th-TH')} (สนามปิด)`);
      continue;
    }

    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.booking.findMany({
            where: { fieldId, date: d, status: { in: ['PENDING', 'APPROVED'] } },
            select: { timeSlot: true },
          });
          if (hasSlotConflict(existing.map((b) => b.timeSlot), [timeSlot])) {
            throw Object.assign(new Error('conflict'), { isConflict: true });
          }
          // Auto-approve inside the same tx: avoids a race where another writer
          // cancels the PENDING row before the post-loop updateMany flips it back to APPROVED.
          return tx.booking.create({
            data: {
              userId: session.user.id,
              fieldId,
              date: d,
              timeSlot,
              note,
              isRecurring: true,
              recurringGroupId: groupId,
              status: 'APPROVED',
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

  const status = bookings.length === 0 ? 409 : errors.length === 0 ? 201 : 200;
  return NextResponse.json({ bookings, errors, groupId }, { status });
}
