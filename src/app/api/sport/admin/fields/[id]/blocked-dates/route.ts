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
  const { date, reason } = await req.json();
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  dateObj.setUTCHours(0, 0, 0, 0);

  try {
    const blocked = await prisma.fieldBlockedDate.create({
      data: { fieldId: id, date: dateObj, reason: reason || null },
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
