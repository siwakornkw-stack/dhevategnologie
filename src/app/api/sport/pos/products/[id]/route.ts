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
  // Stock-variant (pack) linkage. Resolve the intended config, validate, then only apply
  // (and guard) when it actually changes — so routine edits (name/price) on a sold pack still work.
  if (body.stockParentId !== undefined || body.unitsPerStock !== undefined) {
    const cur = await prisma.posProduct.findUnique({ where: { id }, select: { stockParentId: true, unitsPerStock: true, stockQty: true } });
    if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });

    let newParent: string | null = cur.stockParentId;
    let newUnits = cur.unitsPerStock;

    if (body.stockParentId !== undefined) {
      if (!body.stockParentId) {
        newParent = null;
        newUnits = 1;
      } else {
        if (typeof body.stockParentId !== 'string' || body.stockParentId === id) {
          return NextResponse.json({ error: 'สินค้าฐานไม่ถูกต้อง' }, { status: 400 });
        }
        const parent = await prisma.posProduct.findUnique({ where: { id: body.stockParentId }, select: { id: true, stockParentId: true, deletedAt: true } });
        if (!parent || parent.deletedAt) return NextResponse.json({ error: 'ไม่พบสินค้าฐาน' }, { status: 400 });
        if (parent.stockParentId) return NextResponse.json({ error: 'สินค้าฐานต้องไม่เป็นแพ็ค' }, { status: 400 });
        const childCount = await prisma.posProduct.count({ where: { stockParentId: id, deletedAt: null } });
        if (childCount > 0) return NextResponse.json({ error: 'สินค้านี้เป็นฐานของแพ็คอื่นอยู่ เปลี่ยนเป็นแพ็คไม่ได้' }, { status: 400 });
        const u = Number(body.unitsPerStock);
        if (!Number.isInteger(u) || u < 1 || u > 100_000) return NextResponse.json({ error: 'จำนวนต่อแพ็คไม่ถูกต้อง (1-100000)' }, { status: 400 });
        newParent = parent.id;
        newUnits = u;
      }
    } else {
      // unitsPerStock only — meaningful only for a variant.
      const u = Number(body.unitsPerStock);
      if (!Number.isInteger(u) || u < 1 || u > 100_000) return NextResponse.json({ error: 'จำนวนต่อแพ็คไม่ถูกต้อง (1-100000)' }, { status: 400 });
      if (!cur.stockParentId && u !== 1) return NextResponse.json({ error: 'ตั้งจำนวนต่อแพ็คได้เฉพาะสินค้าที่เป็นแพ็ค' }, { status: 400 });
      newUnits = u;
    }

    const linkageChanging = newParent !== cur.stockParentId || newUnits !== cur.unitsPerStock;
    if (linkageChanging) {
      // Reversal paths re-resolve the multiplier from live config; forbid changing it while a
      // still-reversible sale references this product, to prevent silent stock drift on void/refund.
      const activeItem = await prisma.posOrderItem.findFirst({
        where: { productId: id, status: 'ACTIVE', tab: { status: { in: ['OPEN', 'MERGED'] } } },
        select: { id: true },
      });
      if (activeItem) return NextResponse.json({ error: 'มีรายการค้างในบิลที่เปิดอยู่ เปลี่ยนการตั้งค่าแพ็คไม่ได้' }, { status: 409 });
      const paidInv = await prisma.posInvoice.findFirst({
        where: { status: 'PAID', itemsSnapshot: { array_contains: [{ productId: id }] } },
        select: { id: true },
      });
      if (paidInv) return NextResponse.json({ error: 'มีบิลที่ยัง void/refund ได้ เปลี่ยนการตั้งค่าแพ็คไม่ได้' }, { status: 409 });

      // Converting base -> variant would strand this row's own stock. Require it be 0 first.
      if (!cur.stockParentId && newParent && cur.stockQty > 0) {
        return NextResponse.json({ error: 'ปรับสต็อกสินค้านี้ให้เป็น 0 ก่อนเปลี่ยนเป็นแพ็ค' }, { status: 400 });
      }
      data.stockParentId = newParent;
      data.unitsPerStock = newUnits;
    }
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
