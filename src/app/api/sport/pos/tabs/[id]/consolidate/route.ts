import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

// "เซฟรายการ" — merge duplicate line items of the same product into one row (sum qty),
// so re-clicking a product card no longer leaves the cart scattered with duplicates.
// Stock is left untouched: total qty across the product is unchanged, so the existing
// SALE movements stay balanced. Merged-away rows are soft-voided (no VOID movement —
// they were absorbed, not returned). Only plain rows merge (discount 0, no note, same price);
// rows with a discount/note keep their own line.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: tabId } = await ctx.params;

  try {
    await prisma.$transaction(async (tx) => {
      const tab = await tx.posTab.findUnique({ where: { id: tabId }, select: { status: true, openedBy: true } });
      if (!tab) throw new Error('NOT_FOUND');
      if (tab.status !== 'OPEN' && tab.status !== 'MERGED') throw new Error('TAB_NOT_OPEN');
      if (session.user.role !== 'ADMIN' && tab.openedBy && tab.openedBy !== session.user.id) throw new Error('FORBIDDEN');

      const items = await tx.posOrderItem.findMany({
        where: { tabId, status: 'ACTIVE', discount: 0, note: null },
        orderBy: { createdAt: 'asc' },
      });
      const groups = new Map<string, typeof items>();
      for (const it of items) {
        const key = `${it.productId}|${it.unitPrice}`;
        const g = groups.get(key);
        if (g) g.push(it);
        else groups.set(key, [it]);
      }
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const [keep, ...rest] = g;
        const total = g.reduce((s, i) => s + i.qty, 0);
        await tx.posOrderItem.update({ where: { id: keep.id }, data: { qty: total } });
        await tx.posOrderItem.updateMany({ where: { id: { in: rest.map((r) => r.id) } }, data: { status: 'VOID' } });
      }
    });

    const items = await prisma.posOrderItem.findMany({
      where: { tabId, status: 'ACTIVE' },
      select: { id: true, productName: true, qty: true, unitPrice: true, discount: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'consolidate failed';
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (msg === 'TAB_NOT_OPEN') return NextResponse.json({ error: 'tab ปิดแล้ว' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
