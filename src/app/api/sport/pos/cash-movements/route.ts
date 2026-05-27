import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, audit } from '@/lib/pos';

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

  try {
    // Re-check shift inside tx so we don't write a cash movement into a shift that
    // closed between the getActiveShift call and the create. Throws CLOSED_RACE if so.
    const mv = await prisma.$transaction(async (tx) => {
      const shift = await tx.posShift.findFirst({
        where: { cashierId: session.user.id, status: 'OPEN' },
        select: { id: true },
      });
      if (!shift) throw new Error('NO_OPEN_SHIFT');
      return tx.posCashMovement.create({
        data: {
          shiftId: shift.id,
          type: type as 'PAY_IN' | 'PAY_OUT',
          amount,
          reason,
          userId: session.user.id,
        },
      });
    });
    audit(session.user.id, 'POS_CASH_MOVEMENT', mv.id, { shiftId: mv.shiftId, type, amount, reason });
    return NextResponse.json(mv, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'failed';
    if (msg === 'NO_OPEN_SHIFT') return NextResponse.json({ error: 'ไม่มีกะที่เปิดอยู่' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
