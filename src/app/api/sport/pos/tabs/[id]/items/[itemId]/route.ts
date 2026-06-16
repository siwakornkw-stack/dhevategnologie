import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings, applyStock } from '@/lib/pos';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: tabId, itemId } = await ctx.params;

  const { qty } = await req.json();
  const qtyNum = Number(qty);
  if (!Number.isInteger(qtyNum) || qtyNum <= 0 || qtyNum > 10_000) {
    return NextResponse.json({ error: 'qty required (1-10000)' }, { status: 400 });
  }
  const isAdmin = session.user.role === 'ADMIN';
  const allowNegative = (await getPosSettings()).allowNegativeStock;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.posOrderItem.findUnique({ where: { id: itemId } });
      if (!item || item.tabId !== tabId) throw new Error('NOT_FOUND');
      if (item.status !== 'ACTIVE') throw new Error('ALREADY_VOID');
      const tab = await tx.posTab.findUnique({ where: { id: tabId }, select: { status: true, openedBy: true } });
      if (!tab || (tab.status !== 'OPEN' && tab.status !== 'MERGED')) throw new Error('TAB_NOT_OPEN');
      if (!isAdmin && tab.openedBy && tab.openedBy !== session.user.id) throw new Error('FORBIDDEN');

      const delta = qtyNum - item.qty;
      if (delta !== 0) {
        await applyStock(tx, item.productId, -delta, { type: 'ADJUST', refType: 'ITEM_QTY', refId: itemId, userId: session.user.id, allowNegative });
      }
      const maxDiscount = item.unitPrice * qtyNum;
      const nextDiscount = Math.min(item.discount, maxDiscount);
      return tx.posOrderItem.update({ where: { id: itemId }, data: { qty: qtyNum, discount: nextDiscount } });
    }, { timeout: 15000, maxWait: 8000 });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'update failed';
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (msg === 'STOCK_INSUFFICIENT') return NextResponse.json({ error: 'สต็อกไม่พอ' }, { status: 409 });
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: tabId, itemId } = await ctx.params;

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.posOrderItem.findUnique({ where: { id: itemId } });
      if (!item || item.tabId !== tabId) throw new Error('NOT_FOUND');
      if (item.status !== 'ACTIVE') throw new Error('ALREADY_VOID');
      const tab = await tx.posTab.findUnique({ where: { id: tabId }, select: { status: true, openedBy: true } });
      if (!tab || (tab.status !== 'OPEN' && tab.status !== 'MERGED')) throw new Error('TAB_NOT_OPEN');
      if (session.user.role !== 'ADMIN' && tab.openedBy && tab.openedBy !== session.user.id) throw new Error('FORBIDDEN');

      await applyStock(tx, item.productId, item.qty, { type: 'VOID', refType: 'ITEM_VOID', refId: itemId, userId: session.user.id, allowNegative: true });
      await tx.posOrderItem.update({ where: { id: itemId }, data: { status: 'VOID' } });
    }, { timeout: 15000, maxWait: 8000 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'void failed';
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
