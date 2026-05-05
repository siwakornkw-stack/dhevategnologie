import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { rateLimit, WAITING_LIST_RATE_LIMIT } from '@/lib/rate-limit';
import { expandTimeSlot } from '@/lib/booking';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const fieldId = searchParams.get('fieldId');
  const date = searchParams.get('date');
  const timeSlot = searchParams.get('timeSlot');

  if (!fieldId || !date || !timeSlot) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  const [myEntry, count] = await Promise.all([
    prisma.waitingList.findUnique({
      where: { fieldId_date_timeSlot_userId: { fieldId, date: parsedDate, timeSlot, userId: session.user.id } },
    }),
    prisma.waitingList.count({ where: { fieldId, date: parsedDate, timeSlot } }),
  ]);

  const position = myEntry
    ? await prisma.waitingList.count({
        where: { fieldId, date: parsedDate, timeSlot, createdAt: { lte: myEntry.createdAt } },
      })
    : null;

  return NextResponse.json({ isWaiting: !!myEntry, count, position });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`waiting:${session.user.id}`, WAITING_LIST_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });

  const { fieldId, date, timeSlot } = await req.json();
  if (!fieldId || !date || !timeSlot) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const postDate = new Date(date);
  if (isNaN(postDate.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  const existingBookings = await prisma.booking.findMany({
    where: { fieldId, date: postDate, status: { in: ['PENDING', 'APPROVED'] } },
    select: { timeSlot: true, userId: true },
  });

  const requestedSlots = expandTimeSlot(timeSlot);
  const takenByAnyone = new Set(existingBookings.flatMap((b) => expandTimeSlot(b.timeSlot)));

  if (!requestedSlots.some((s) => takenByAnyone.has(s))) {
    return NextResponse.json({ error: 'ช่วงเวลานี้ยังมีว่าง สามารถจองได้เลย' }, { status: 400 });
  }

  const takenByUser = new Set(
    existingBookings.filter((b) => b.userId === session.user.id).flatMap((b) => expandTimeSlot(b.timeSlot)),
  );
  if (requestedSlots.some((s) => takenByUser.has(s))) {
    return NextResponse.json({ error: 'คุณมีการจองในช่วงเวลานี้อยู่แล้ว' }, { status: 400 });
  }

  try {
    const entry = await prisma.waitingList.create({
      data: { userId: session.user.id, fieldId, date: postDate, timeSlot },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'คุณอยู่ใน waiting list แล้ว' }, { status: 409 });
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fieldId, date, timeSlot } = await req.json();
  if (!fieldId || !date || !timeSlot) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  await prisma.waitingList.deleteMany({
    where: { userId: session.user.id, fieldId, date: parsedDate, timeSlot },
  });

  return NextResponse.json({ ok: true });
}
