import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { sendBookingCreatedEmail } from '@/lib/email';
import { notifyLineNewBooking } from '@/lib/line-notify';
import { rateLimit, BOOKING_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');

  if (all === 'true' && session.user.role === 'ADMIN') {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: { select: { id: true, name: true, sportType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(bookings);
  }

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: {
      field: { select: { id: true, name: true, sportType: true, imageUrl: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit(`booking-create:${session.user.id}:${ip}`, BOOKING_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });

  const body = await req.json();
  const { fieldId, date, timeSlot, note } = body;

  if (!fieldId || !date || !timeSlot) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);

  if (bookingDate < today || bookingDate > maxDate) {
    return NextResponse.json({ error: 'สามารถจองได้ล่วงหน้าสูงสุด 7 วัน' }, { status: 400 });
  }

  const existing = await prisma.booking.findFirst({
    where: {
      userId: session.user.id,
      date: bookingDate,
      status: { in: ['PENDING', 'APPROVED'] },
    },
  });

  if (existing) {
    return NextResponse.json({ error: 'คุณมีการจองในวันนี้แล้ว กรุณายกเลิกก่อนจองใหม่' }, { status: 400 });
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        userId: session.user.id,
        fieldId,
        date: bookingDate,
        timeSlot,
        note,
      },
      include: {
        field: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });
    const emailData = {
      userName: booking.user?.name ?? 'ลูกค้า',
      fieldName: booking.field.name,
      date: new Date(date).toLocaleDateString('th-TH'),
      timeSlot,
    };
    await Promise.all([
      sendBookingCreatedEmail(session.user.email!, emailData),
      notifyLineNewBooking(emailData),
    ]);

    return NextResponse.json(booking, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'ช่วงเวลานี้ถูกจองแล้ว' }, { status: 409 });
  }
}
