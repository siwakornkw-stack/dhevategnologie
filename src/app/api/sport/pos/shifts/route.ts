import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getActiveShift, nextShiftNo, audit } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const cashierId = searchParams.get('cashierId');
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const isAdmin = session.user.role === 'ADMIN';

  const where: Record<string, unknown> = {};
  if (status === 'OPEN' || status === 'CLOSED') where.status = status;
  if (cashierId) where.cashierId = cashierId;
  if (!isAdmin) where.cashierId = session.user.id;
  if (fromStr || toStr) {
    const range: Record<string, Date> = {};
    if (fromStr) { const d = new Date(fromStr); if (!isNaN(d.getTime())) range.gte = d; }
    if (toStr) { const d = new Date(toStr); if (!isNaN(d.getTime())) range.lte = d; }
    if (Object.keys(range).length > 0) where.openedAt = range;
  }

  const shifts = await prisma.posShift.findMany({
    where,
    orderBy: { openedAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(shifts);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const openingFloat = Number(body.openingFloat);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return NextResponse.json({ error: 'openingFloat invalid' }, { status: 400 });
  }
  const openingNote = body.openingNote?.toString().slice(0, 500) || null;

  try {
    const shift = await prisma.$transaction(async (tx) => {
      const existing = await getActiveShift(session.user.id, tx);
      if (existing) throw new Error('SHIFT_ALREADY_OPEN');
      const shiftNo = await nextShiftNo(tx);
      return tx.posShift.create({
        data: {
          shiftNo,
          cashierId: session.user.id,
          openingFloat,
          openingNote,
        },
      });
    });
    audit(session.user.id, 'POS_SHIFT_OPEN', shift.id, { openingFloat, openingNote });
    return NextResponse.json(shift, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'open failed';
    if (msg === 'SHIFT_ALREADY_OPEN') {
      return NextResponse.json({ error: 'มีกะเปิดอยู่แล้ว' }, { status: 409 });
    }
    // Partial unique index `PosShift_cashier_open_unique` blocks concurrent OPEN
    if (msg.includes('PosShift_cashier_open_unique') || msg.includes('Unique')) {
      return NextResponse.json({ error: 'มีกะเปิดอยู่แล้ว' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
