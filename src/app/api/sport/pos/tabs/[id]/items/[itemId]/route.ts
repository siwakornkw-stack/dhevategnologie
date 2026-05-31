import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

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

      await tx.posProduct.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } });
      await tx.posStockMovement.create({
        data: {
          productId: item.productId,
          type: 'VOID',
          qty: item.qty,
          refType: 'ITEM_VOID',
          refId: itemId,
          userId: session.user.id,
        },
      });
      await tx.posOrderItem.update({ where: { id: itemId }, data: { status: 'VOID' } });
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'void failed';
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
