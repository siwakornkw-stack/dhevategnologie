import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, audit } from '@/lib/pos';

async function buildSummary(shiftId: string) {
  const shift = await prisma.posShift.findUnique({
    where: { id: shiftId },
    select: { openingFloat: true, countedCash: true },
  });
  const invoices = await prisma.posInvoice.findMany({
    where: { shiftId },
    include: { payments: true, splits: true, refunds: true },
  });
  const refunds = await prisma.posRefund.findMany({ where: { shiftId } });
  const movements = await prisma.posCashMovement.findMany({ where: { shiftId }, orderBy: { createdAt: 'asc' } });

  const grossPaid = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const voidTotal = invoices.filter((i) => i.status === 'VOID').reduce((s, i) => s + i.total, 0);
  const refundTotal = refunds.reduce((s, r) => s + r.amount, 0);

  const methodTotals: Record<string, number> = { CASH: 0, TRANSFER: 0, QR: 0, QR_FIELD: 0, CARD: 0, OTHER: 0 };
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue;
    if (inv.splits.length) {
      for (const sp of inv.splits) methodTotals[sp.method] = (methodTotals[sp.method] || 0) + sp.amount;
    } else {
      for (const p of inv.payments) methodTotals[p.method] = (methodTotals[p.method] || 0) + p.amount;
    }
  }
  for (const r of refunds) methodTotals[r.method] = (methodTotals[r.method] || 0) - r.amount;

  // By category — products sold on this shift's PAID invoices, grouped by current category.
  // Attribute each product line to its invoice's payment method (single method, or the
  // largest split when paid by multiple methods), then aggregate per product + per category.
  type MethodAgg = Record<string, { qty: number; revenue: number }>;
  const addM = (m: MethodAgg, method: string, qty: number, revenue: number) => {
    if (!m[method]) m[method] = { qty: 0, revenue: 0 };
    m[method].qty += qty;
    m[method].revenue += revenue;
  };
  const prodAgg: Record<string, { name: string; qty: number; revenue: number; methods: MethodAgg }> = {};
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue;
    const method = inv.splits.length
      ? ([...inv.splits].sort((a, b) => b.amount - a.amount)[0]?.method ?? 'OTHER')
      : (inv.payments[0]?.method ?? 'OTHER');
    const snap = (inv.itemsSnapshot as Array<{ productId?: string; productName?: string; qty: number; unitPrice: number; discount: number }> | null) || [];
    for (const it of snap) {
      if (!it.productId) continue;
      const rev = it.unitPrice * it.qty - it.discount;
      if (!prodAgg[it.productId]) prodAgg[it.productId] = { name: it.productName || it.productId, qty: 0, revenue: 0, methods: {} };
      const p = prodAgg[it.productId];
      p.qty += it.qty;
      p.revenue += rev;
      addM(p.methods, method, it.qty, rev);
    }
  }
  const prodIds = Object.keys(prodAgg);
  const prods = prodIds.length
    ? await prisma.posProduct.findMany({ where: { id: { in: prodIds } }, select: { id: true, category: true } })
    : [];
  const catOf = new Map(prods.map((p) => [p.id, p.category || 'ไม่ระบุหมวด']));
  const catMap: Record<string, { count: number; revenue: number; methods: MethodAgg }> = {};
  for (const [id, v] of Object.entries(prodAgg)) {
    const cat = catOf.get(id) || 'ไม่ระบุหมวด';
    if (!catMap[cat]) catMap[cat] = { count: 0, revenue: 0, methods: {} };
    catMap[cat].count += v.qty;
    catMap[cat].revenue += v.revenue;
    for (const [m, mv] of Object.entries(v.methods)) addM(catMap[cat].methods, m, mv.qty, mv.revenue);
  }
  const byCategory = Object.entries(catMap)
    .map(([category, v]) => ({ category, count: v.count, revenue: v.revenue, methods: v.methods }))
    .sort((a, b) => b.revenue - a.revenue);
  const topProducts = Object.entries(prodAgg)
    .map(([productId, v]) => ({ productId, name: v.name, qty: v.qty, revenue: v.revenue, methods: v.methods }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50);

  const payIn = movements.filter((m) => m.type === 'PAY_IN').reduce((s, m) => s + m.amount, 0);
  const payOut = movements.filter((m) => m.type === 'PAY_OUT').reduce((s, m) => s + m.amount, 0);

  // Expected drawer cash. methodTotals.CASH already nets out CASH refunds (subtracted above).
  const openingFloat = shift?.openingFloat ?? 0;
  const expectedCash = +(openingFloat + methodTotals.CASH + payIn - payOut).toFixed(2);
  const countedCash = shift?.countedCash ?? null;
  const cashDiff = countedCash != null ? +(countedCash - expectedCash).toFixed(2) : null;

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
    byCategory,
    topProducts,
    payIn: +payIn.toFixed(2),
    payOut: +payOut.toFixed(2),
    openingFloat,
    expectedCash,
    countedCash,
    cashDiff,
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
      // Block close if cashier still has open tabs; otherwise cash math is unreliable
      // because pending tab items won't be reflected in invoices/payments for this shift.
      const openTabs = await tx.posTab.count({
        where: { openedBy: shift.cashierId, status: { in: ['OPEN', 'HELD'] } },
      });
      if (openTabs > 0) throw new Error('OPEN_TABS_EXIST');
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
      const closed = await tx.posShift.findUnique({ where: { id } });
      // Audit inside tx so close + audit row are atomic; summary built outside (read-only)
      await audit(session.user.id, 'POS_SHIFT_CLOSE', id, { countedCash, closingNote }, tx);
      return closed;
    });
    const summary = await buildSummary(id);
    return NextResponse.json({ ...result, summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'close failed';
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบกะ' }, { status: 404 });
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (msg === 'ALREADY_CLOSED') return NextResponse.json({ error: 'กะปิดไปแล้ว' }, { status: 409 });
    if (msg === 'OPEN_TABS_EXIST') return NextResponse.json({ error: 'ยังมี tab ที่ยังไม่ปิด/ยังไม่ checkout' }, { status: 409 });
    if (msg === 'SHIFT_RACE') return NextResponse.json({ error: 'กะถูกปิดโดยอีกหน้าจอ' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
