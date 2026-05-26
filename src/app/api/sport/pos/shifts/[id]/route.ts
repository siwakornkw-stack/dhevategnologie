import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, audit } from '@/lib/pos';

async function buildSummary(shiftId: string) {
  const invoices = await prisma.posInvoice.findMany({
    where: { shiftId },
    include: { payments: true, splits: true, refunds: true },
  });
  const refunds = await prisma.posRefund.findMany({ where: { shiftId } });
  const movements = await prisma.posCashMovement.findMany({ where: { shiftId }, orderBy: { createdAt: 'asc' } });

  const grossPaid = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const voidTotal = invoices.filter((i) => i.status === 'VOID').reduce((s, i) => s + i.total, 0);
  const refundTotal = refunds.reduce((s, r) => s + r.amount, 0);

  const methodTotals: Record<string, number> = { CASH: 0, TRANSFER: 0, QR: 0, CARD: 0, OTHER: 0 };
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue;
    if (inv.splits.length) {
      for (const sp of inv.splits) methodTotals[sp.method] = (methodTotals[sp.method] || 0) + sp.amount;
    } else {
      for (const p of inv.payments) methodTotals[p.method] = (methodTotals[p.method] || 0) + p.amount;
    }
  }
  for (const r of refunds) methodTotals[r.method] = (methodTotals[r.method] || 0) - r.amount;

  const payIn = movements.filter((m) => m.type === 'PAY_IN').reduce((s, m) => s + m.amount, 0);
  const payOut = movements.filter((m) => m.type === 'PAY_OUT').reduce((s, m) => s + m.amount, 0);

  return {
    invoiceCount: invoices.length,
    paidCount: invoices.filter((i) => i.status === 'PAID').length,
    voidCount: invoices.filter((i) => i.status === 'VOID').length,
    refundCount: refunds.length,
    grossPaid,
    voidTotal,
    refundTotal,
    netSales: +(grossPaid - refundTotal).toFixed(2),
    methodTotals,
    payIn: +payIn.toFixed(2),
    payOut: +payOut.toFixed(2),
    movements,
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const shift = await prisma.posShift.findUnique({ where: { id } });
  if (!shift) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && shift.cashierId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const summary = await buildSummary(id);
  return NextResponse.json({ ...shift, summary });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const countedCashRaw = body.countedCash;
  const closingNote = body.closingNote?.toString().slice(0, 500) || null;

  if (countedCashRaw === undefined || countedCashRaw === null) {
    return NextResponse.json({ error: 'countedCash required' }, { status: 400 });
  }
  const countedCash = Number(countedCashRaw);
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return NextResponse.json({ error: 'countedCash invalid' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const shift = await tx.posShift.findUnique({ where: { id } });
      if (!shift) throw new Error('NOT_FOUND');
      if (session.user.role !== 'ADMIN' && shift.cashierId !== session.user.id) throw new Error('FORBIDDEN');
      if (shift.status !== 'OPEN') throw new Error('ALREADY_CLOSED');
      const upd = await tx.posShift.updateMany({
        where: { id, status: 'OPEN' },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: session.user.id,
          countedCash,
          closingNote,
        },
      });
      if (upd.count !== 1) throw new Error('SHIFT_RACE');
      return tx.posShift.findUnique({ where: { id } });
    });
    const summary = await buildSummary(id);
    audit(session.user.id, 'POS_SHIFT_CLOSE', id, { countedCash, closingNote, summary });
    return NextResponse.json({ ...result, summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'close failed';
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบกะ' }, { status: 404 });
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (msg === 'ALREADY_CLOSED') return NextResponse.json({ error: 'กะปิดไปแล้ว' }, { status: 409 });
    if (msg === 'SHIFT_RACE') return NextResponse.json({ error: 'กะถูกปิดโดยอีกหน้าจอ' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
