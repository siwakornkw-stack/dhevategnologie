import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const category = searchParams.get('category')?.trim();
  const activeOnly = searchParams.get('active') !== '0';

  const products = await prisma.posProduct.findMany({
    where: {
      deletedAt: null,
      ...(activeOnly ? { isActive: true } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true, name: true, sku: true, category: true,
      price: true, cost: true, stockQty: true, stockUnit: true,
      lowStockAlert: true, imageUrl: true, isActive: true,
      stockParentId: true, unitsPerStock: true,
      stockParent: { select: { stockQty: true } },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  // For a stock-variant (pack), expose the effective available stock derived from its base product.
  const withEffective = products.map((p) =>
    p.stockParentId && p.unitsPerStock > 0
      ? { ...p, stockQty: Math.floor((p.stockParent?.stockQty ?? 0) / p.unitsPerStock) }
      : p,
  );
  return NextResponse.json(withEffective, {
    headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' },
  });
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, sku, category, price, cost, stockQty, stockUnit, lowStockAlert, imageUrl, stockParentId, unitsPerStock } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return NextResponse.json({ error: 'price invalid' }, { status: 400 });
  }
  const costNum = cost === undefined || cost === null || cost === '' ? 0 : Number(cost);
  if (!Number.isFinite(costNum) || costNum < 0) {
    return NextResponse.json({ error: 'cost invalid' }, { status: 400 });
  }
  const stockNum = stockQty === undefined || stockQty === null || stockQty === '' ? 0 : Number(stockQty);
  if (!Number.isInteger(stockNum) || stockNum < 0) {
    return NextResponse.json({ error: 'stockQty must be non-negative integer' }, { status: 400 });
  }

  // Stock-variant (pack): draws stock from a base product. Validate parent + units.
  let parentId: string | null = null;
  let units = 1;
  if (stockParentId) {
    if (typeof stockParentId !== 'string') {
      return NextResponse.json({ error: 'stockParentId invalid' }, { status: 400 });
    }
    const parent = await prisma.posProduct.findUnique({ where: { id: stockParentId }, select: { id: true, stockParentId: true, deletedAt: true } });
    if (!parent || parent.deletedAt) {
      return NextResponse.json({ error: 'ไม่พบสินค้าฐาน' }, { status: 400 });
    }
    if (parent.stockParentId) {
      return NextResponse.json({ error: 'สินค้าฐานต้องไม่เป็นแพ็คอยู่แล้ว' }, { status: 400 });
    }
    const u = Number(unitsPerStock);
    if (!Number.isInteger(u) || u < 1 || u > 100_000) {
      return NextResponse.json({ error: 'จำนวนต่อแพ็คไม่ถูกต้อง (1-100000)' }, { status: 400 });
    }
    parentId = parent.id;
    units = u;
  }
  // A variant tracks no stock of its own; its stock comes from the base product.
  const ownStock = parentId ? 0 : stockNum;

  try {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.posProduct.create({
        data: {
          name: name.trim(),
          sku: sku?.trim() || null,
          category: category?.trim() || null,
          price: priceNum,
          cost: costNum,
          stockQty: ownStock,
          stockUnit: stockUnit?.trim() || 'ชิ้น',
          lowStockAlert: Number.isInteger(Number(lowStockAlert)) ? Number(lowStockAlert) : 5,
          imageUrl: imageUrl?.trim() || null,
          stockParentId: parentId,
          unitsPerStock: units,
        },
      });
      if (!parentId && stockNum > 0) {
        await tx.posStockMovement.create({
          data: {
            productId: p.id,
            type: 'IN',
            qty: stockNum,
            refType: 'INIT',
            note: 'opening stock',
            userId: session.user.id,
          },
        });
      }
      return p;
    });
    prisma.auditLog
      .create({
        data: { adminId: session.user.id, action: 'POS_PRODUCT_CREATE', targetId: product.id, details: { name: product.name } },
      })
      .catch(() => {});
    return NextResponse.json(product, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'create failed';
    if (msg.includes('Unique')) return NextResponse.json({ error: 'SKU ซ้ำ' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
