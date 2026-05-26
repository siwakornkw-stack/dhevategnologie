import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getActiveShift, audit } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get('shiftId');
  const isAdmin = session.user.role === 'ADMIN';
  const where: Record<string, unknown> = {};
  if (shiftId) where.shiftId = shiftId;
  if (!isAdmin) where.shift = { cashierId: session.user.id };

  if (!isAdmin && shiftId) {
    const s = await prisma.posShift.findUnique({ where: { id: shiftId }, select: { cashierId: true } });
    if (!s || s.cashierId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const rows = await prisma.posCashMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = String(body.type || '').trim();
  const amount = Number(body.amount);
  const reason = body.reason?.toString().slice(0, 500) || null;

  if (!['PAY_IN', 'PAY_OUT'].includes(type)) {
    return NextResponse.json({ error: 'type ต้องเป็น PAY_IN หรือ PAY_OUT' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount invalid' }, { status: 400 });
  }

  const shift = await getActiveShift(session.user.id);
  if (!shift) return NextResponse.json({ error: 'ไม่มีกะที่เปิดอยู่' }, { status: 409 });

  const mv = await prisma.posCashMovement.create({
    data: {
      shiftId: shift.id,
      type: type as 'PAY_IN' | 'PAY_OUT',
      amount,
      reason,
      userId: session.user.id,
    },
  });
  audit(session.user.id, 'POS_CASH_MOVEMENT', mv.id, { shiftId: shift.id, type, amount, reason });
  return NextResponse.json(mv, { status: 201 });
}
