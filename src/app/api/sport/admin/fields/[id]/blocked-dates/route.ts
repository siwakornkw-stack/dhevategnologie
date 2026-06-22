import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') return null;
  return session;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dates = await prisma.fieldBlockedDate.findMany({
    where: { fieldId: id },
    orderBy: { date: 'asc' },
  });
  return NextResponse.json(dates);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { date, reason, startTime, endTime } = await req.json();
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  dateObj.setUTCHours(0, 0, 0, 0);

  // Optional time window: both must be provided together and well-formed; start < end.
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
  let start: string | null = null;
  let end: string | null = null;
  if (startTime || endTime) {
    if (!hm.test(startTime || '') || !hm.test(endTime || '')) {
      return NextResponse.json({ error: 'รูปแบบเวลาไม่ถูกต้อง (HH:MM)' }, { status: 400 });
    }
    // start > end is allowed: an overnight window (e.g. 17:00-01:00) wraps past midnight.
    if (startTime === endTime) {
      return NextResponse.json({ error: 'เวลาเริ่มและสิ้นสุดต้องไม่เท่ากัน' }, { status: 400 });
    }
    start = startTime;
    end = endTime;
  }

  try {
    const blocked = await prisma.fieldBlockedDate.create({
      data: { fieldId: id, date: dateObj, reason: reason || null, startTime: start, endTime: end },
    });
    return NextResponse.json(blocked, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'วันที่นี้ถูกบล็อกไว้แล้ว' }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { date } = await req.json();
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  dateObj.setUTCHours(0, 0, 0, 0);

  await prisma.fieldBlockedDate.deleteMany({ where: { fieldId: id, date: dateObj } });
  return NextResponse.json({ ok: true });
}
