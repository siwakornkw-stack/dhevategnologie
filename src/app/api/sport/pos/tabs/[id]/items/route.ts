import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings } from '@/lib/pos';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: tabId } = await ctx.params;

  const { productId, qty, note, unitPrice, discount } = await req.json();
  const qtyNum = Number(qty);
  if (!productId || !Number.isInteger(qtyNum) || qtyNum <= 0 || qtyNum > 10_000) {
    return NextResponse.json({ error: 'productId + qty required (qty 1-10000)' }, { status: 400 });
  }
  const isAdmin = session.user.role === 'ADMIN';
  const discountNum = Math.max(0, Number(discount) || 0);
  if (!Number.isFinite(discountNum) || discountNum > 1_000_000) {
    return NextResponse.json({ error: 'discount ไม่ถูกต้อง' }, { status: 400 });
  }
  let unitPriceOverride: number | null = null;
  if (unitPrice !== undefined) {
    if (!isAdmin) {
      return NextResponse.json({ error: 'unitPrice override ต้องเป็น ADMIN' }, { status: 403 });
    }
    const n = Number(unitPrice);
    // Cap override to keep subtotal = unitPrice * qty within safe integer range.
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      return NextResponse.json({ error: 'unitPrice ไม่ถูกต้อง' }, { status: 400 });
    }
    unitPriceOverride = n;
  }

  const settings = await getPosSettings();
  const allowNegative = settings.allowNegativeStock;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tab = await tx.posTab.findUnique({ where: { id: tabId }, select: { status: true } });
      if (!tab) throw new Error('TAB_NOT_FOUND');
      if (tab.status !== 'OPEN') throw new Error('TAB_NOT_OPEN');

      const product = await tx.posProduct.findUnique({ where: { id: productId } });
      if (!product || product.deletedAt) throw new Error('PRODUCT_NOT_FOUND');
      if (!product.isActive) throw new Error('PRODUCT_INACTIVE');

      if (allowNegative) {
        await tx.posProduct.update({ where: { id: productId }, data: { stockQty: { decrement: qtyNum } } });
      } else {
        const r = await tx.posProduct.updateMany({
          where: { id: productId, stockQty: { gte: qtyNum } },
          data: { stockQty: { decrement: qtyNum } },
        });
        if (r.count === 0) throw new Error('STOCK_INSUFFICIENT');
      }
      await tx.posStockMovement.create({
        data: {
          productId,
          type: 'SALE',
          qty: -qtyNum,
          refType: 'TAB',
          refId: tabId,
          userId: session.user.id,
        },
      });
      const finalUnitPrice = unitPriceOverride !== null ? unitPriceOverride : product.price;
      const maxDiscount = finalUnitPrice * qtyNum;
      if (discountNum > maxDiscount) throw new Error('DISCOUNT_TOO_LARGE');
      const item = await tx.posOrderItem.create({
        data: {
          tabId,
          productId,
          productName: product.name,
          qty: qtyNum,
          unitPrice: finalUnitPrice,
          discount: discountNum,
          note: note?.toString().slice(0, 200) || null,
          createdBy: session.user.id,
        },
      });
      return item;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'add failed';
    if (msg === 'DISCOUNT_TOO_LARGE') return NextResponse.json({ error: 'ส่วนลดเกินราคารวม' }, { status: 400 });
    if (msg === 'STOCK_INSUFFICIENT') return NextResponse.json({ error: 'สต็อกไม่พอ' }, { status: 409 });
    if (msg === 'TAB_NOT_OPEN') return NextResponse.json({ error: 'tab ปิดแล้ว' }, { status: 409 });
    if (msg === 'PRODUCT_INACTIVE') return NextResponse.json({ error: 'สินค้าปิดขาย' }, { status: 409 });
    if (msg === 'TAB_NOT_FOUND' || msg === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
