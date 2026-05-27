import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId') || undefined;
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  const movements = await prisma.posStockMovement.findMany({
    where: { ...(productId ? { productId } : {}) },
    include: { product: { select: { name: true, stockUnit: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(movements);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { productId, type, qty, note } = await req.json();
  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId required' }, { status: 400 });
  }
  if (!['IN', 'OUT', 'ADJUST'].includes(type)) {
    return NextResponse.json({ error: 'type must be IN|OUT|ADJUST' }, { status: 400 });
  }
  const qtyNum = Number(qty);
  if (!Number.isInteger(qtyNum) || qtyNum === 0) {
    return NextResponse.json({ error: 'qty must be non-zero integer' }, { status: 400 });
  }
  // Sanity cap — prevent typo-driven stock corruption (e.g. accidentally entering 1e9)
  if (Math.abs(qtyNum) > 100000) {
    return NextResponse.json({ error: 'qty exceeds maximum (100,000)' }, { status: 400 });
  }

  const settings = await getPosSettings();
  const allowNegative = settings.allowNegativeStock;

  let delta = 0;
  if (type === 'IN') delta = Math.abs(qtyNum);
  else if (type === 'OUT') delta = -Math.abs(qtyNum);
  else delta = qtyNum;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.posProduct.findUnique({ where: { id: productId } });
      if (!product) throw new Error('PRODUCT_NOT_FOUND');

      let updated;
      if (delta >= 0 || allowNegative) {
        updated = await tx.posProduct.update({
          where: { id: productId },
          data: { stockQty: { increment: delta } },
        });
      } else {
        const need = -delta;
        const r = await tx.posProduct.updateMany({
          where: { id: productId, stockQty: { gte: need } },
          data: { stockQty: { decrement: need } },
        });
        if (r.count === 0) throw new Error('STOCK_INSUFFICIENT');
        updated = await tx.posProduct.findUnique({ where: { id: productId } });
        if (!updated) throw new Error('PRODUCT_NOT_FOUND');
      }
      const mv = await tx.posStockMovement.create({
        data: {
          productId,
          type,
          qty: delta,
          refType: 'MANUAL',
          note: note?.toString().slice(0, 500) || null,
          userId: session.user.id,
        },
      });
      return { product: updated, movement: mv };
    });

    prisma.auditLog
      .create({ data: { adminId: session.user.id, action: `POS_STOCK_${type}`, targetId: productId, details: { qty: delta } } })
      .catch(() => {});
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'movement failed';
    if (msg === 'STOCK_INSUFFICIENT') return NextResponse.json({ error: 'สต็อกไม่พอ' }, { status: 409 });
    if (msg === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
