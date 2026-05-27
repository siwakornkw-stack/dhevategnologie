import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.sku !== undefined) data.sku = body.sku?.trim() || null;
  if (body.category !== undefined) data.category = body.category?.trim() || null;
  if (body.stockUnit !== undefined) data.stockUnit = String(body.stockUnit).trim() || 'ชิ้น';
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl?.trim() || null;
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  // Cap price/cost at 1,000,000 to avoid downstream multiplication overflow
  // when combined with qty in subtotal calculation.
  const MAX_UNIT = 1_000_000;
  if (body.price !== undefined) {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0 || n > MAX_UNIT) return NextResponse.json({ error: 'price invalid' }, { status: 400 });
    data.price = n;
  }
  if (body.cost !== undefined) {
    const n = Number(body.cost);
    if (!Number.isFinite(n) || n < 0 || n > MAX_UNIT) return NextResponse.json({ error: 'cost invalid' }, { status: 400 });
    data.cost = n;
  }
  if (body.lowStockAlert !== undefined) {
    const n = Number(body.lowStockAlert);
    if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: 'lowStockAlert invalid' }, { status: 400 });
    data.lowStockAlert = n;
  }

  try {
    const p = await prisma.posProduct.update({ where: { id }, data });
    prisma.auditLog
      .create({ data: { adminId: session.user.id, action: 'POS_PRODUCT_UPDATE', targetId: id, details: data as object } })
      .catch(() => {});
    return NextResponse.json(p);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'update failed';
    if (msg.includes('Unique')) return NextResponse.json({ error: 'SKU ซ้ำ' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  await prisma.posProduct.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  prisma.auditLog
    .create({ data: { adminId: session.user.id, action: 'POS_PRODUCT_DELETE', targetId: id } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
