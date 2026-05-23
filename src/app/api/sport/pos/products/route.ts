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
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, sku, category, price, cost, stockQty, stockUnit, lowStockAlert, imageUrl } = body;

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

  try {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.posProduct.create({
        data: {
          name: name.trim(),
          sku: sku?.trim() || null,
          category: category?.trim() || null,
          price: priceNum,
          cost: costNum,
          stockQty: stockNum,
          stockUnit: stockUnit?.trim() || 'ชิ้น',
          lowStockAlert: Number.isInteger(Number(lowStockAlert)) ? Number(lowStockAlert) : 5,
          imageUrl: imageUrl?.trim() || null,
        },
      });
      if (stockNum > 0) {
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
