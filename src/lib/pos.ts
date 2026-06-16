import type { Prisma, PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Tx = Prisma.TransactionClient | PrismaClient;

type AllowedRole = 'ADMIN' | 'CASHIER';

export async function requirePosRole(roles: AllowedRole[] = ['ADMIN', 'CASHIER']) {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role as AllowedRole | 'USER' | undefined;
  if (!role || !roles.includes(role as AllowedRole)) return null;
  return session;
}

export async function getPosSettings() {
  let settings = await prisma.posSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.posSettings.create({ data: { id: 'default' } });
  }
  return settings;
}

type StockMoveType = 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'VOID';

/**
 * Apply a signed stock change for a product, resolving stock-variants (packs) to their
 * base product and multiplying by unitsPerStock. `signedQty` is in PRODUCT units
 * (negative = sell/deduct, positive = return/add). The stock change AND the movement
 * are recorded against the effective base product, so sum(movements)==stockQty holds
 * per base product. For a normal product (no parent, unitsPerStock=1) this is identical
 * to a plain decrement/increment + movement on that product.
 * Throws STOCK_INSUFFICIENT when a deduction would go negative and allowNegative is false.
 */
export async function applyStock(
  tx: Tx,
  productId: string,
  signedQty: number,
  opts: { type: StockMoveType; refType?: string | null; refId?: string | null; userId?: string | null; note?: string | null; allowNegative?: boolean },
): Promise<void> {
  if (!Number.isInteger(signedQty) || signedQty === 0) return;
  const product = await tx.posProduct.findUnique({
    where: { id: productId },
    select: { id: true, stockParentId: true, unitsPerStock: true },
  });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');
  const targetId = product.stockParentId ?? product.id;
  // Multiplier only applies to a true variant (has a parent). A base product always 1:1,
  // even if a stray unitsPerStock>1 was somehow stored on it.
  const mult = product.stockParentId && product.unitsPerStock && product.unitsPerStock > 0 ? product.unitsPerStock : 1;
  const effective = signedQty * mult;
  if (effective < 0 && !opts.allowNegative) {
    const need = -effective;
    const r = await tx.posProduct.updateMany({
      where: { id: targetId, stockQty: { gte: need } },
      data: { stockQty: { decrement: need } },
    });
    if (r.count === 0) throw new Error('STOCK_INSUFFICIENT');
  } else {
    await tx.posProduct.update({ where: { id: targetId }, data: { stockQty: { increment: effective } } });
  }
  await tx.posStockMovement.create({
    data: {
      productId: targetId,
      type: opts.type,
      qty: effective,
      refType: opts.refType ?? null,
      refId: opts.refId ?? null,
      note: opts.note ?? null,
      userId: opts.userId ?? null,
    },
  });
}

export type VatBreakdown = {
  subtotal: number;
  vatAmount: number;
  total: number;
  vatMode: 'NONE' | 'INCLUDED' | 'EXCLUDED';
  vatRate: number;
};

export async function nextInvoiceNo(tx: Tx = prisma) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `INV-${y}${m}${d}-`;
  const last = await tx.posInvoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });
  const seq = last ? Number(last.invoiceNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function calcVat(
  itemsTotal: number,
  vatMode: 'NONE' | 'INCLUDED' | 'EXCLUDED',
  vatRate: number,
): VatBreakdown {
  const rate = vatRate / 100;
  if (vatMode === 'NONE') {
    return { subtotal: itemsTotal, vatAmount: 0, total: itemsTotal, vatMode, vatRate };
  }
  if (vatMode === 'INCLUDED') {
    const vatAmount = +(itemsTotal * rate / (1 + rate)).toFixed(2);
    return { subtotal: +(itemsTotal - vatAmount).toFixed(2), vatAmount, total: itemsTotal, vatMode, vatRate };
  }
  const vatAmount = +(itemsTotal * rate).toFixed(2);
  return { subtotal: itemsTotal, vatAmount, total: +(itemsTotal + vatAmount).toFixed(2), vatMode, vatRate };
}

export function audit(
  userId: string,
  action: string,
  targetId?: string | null,
  details?: Record<string, unknown> | null,
  tx?: Tx,
) {
  const client = tx ?? prisma;
  const op = client.auditLog.create({
    data: {
      adminId: userId,
      action,
      targetId: targetId || null,
      details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  // When called inside a tx, let failure propagate so the action and the audit row
  // commit/rollback together. Outside a tx, keep fire-and-forget so the request
  // doesn't fail when AuditLog is degraded.
  if (tx) return op;
  return op.catch(() => {});
}

export async function getActiveShift(cashierId: string, tx: Tx = prisma) {
  return tx.posShift.findFirst({
    where: { cashierId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}

export async function nextShiftNo(tx: Tx = prisma) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `SHF-${y}${m}${d}-`;
  const last = await tx.posShift.findFirst({
    where: { shiftNo: { startsWith: prefix } },
    orderBy: { shiftNo: 'desc' },
    select: { shiftNo: true },
  });
  const seq = last ? Number(last.shiftNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function earnPoints(
  tx: Tx,
  userId: string,
  points: number,
  invoiceNo: string,
) {
  if (points <= 0) return;
  await tx.user.update({ where: { id: userId }, data: { points: { increment: points } } });
  await tx.pointTransaction.create({
    data: { userId, points, type: 'EARN', note: `POS earn ${invoiceNo}` },
  });
}

export async function redeemPoints(
  tx: Tx,
  userId: string,
  points: number,
  invoiceNo: string,
) {
  if (points <= 0) return;
  const upd = await tx.user.updateMany({
    where: { id: userId, points: { gte: points } },
    data: { points: { decrement: points } },
  });
  if (upd.count !== 1) throw new Error('POINTS_INSUFFICIENT');
  await tx.pointTransaction.create({
    data: { userId, points: -points, type: 'REDEEM', note: `POS redeem ${invoiceNo}` },
  });
}

export async function reversePoints(
  tx: Tx,
  userId: string,
  earned: number,
  redeemed: number,
  invoiceNo: string,
) {
  if (earned > 0) {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
    const cur = Math.max(u?.points || 0, 0);
    const actual = Math.min(earned, cur);
    if (actual > 0) {
      const r = await tx.user.updateMany({
        where: { id: userId, points: { gte: actual } },
        data: { points: { decrement: actual } },
      });
      if (r.count !== 1) throw new Error('POINTS_REVERSE_RACE');
    }
    await tx.pointTransaction.create({
      data: {
        userId,
        points: -actual,
        type: 'REVERSE_EARN',
        note: `POS void ${invoiceNo}${actual < earned ? ` (clamped from ${earned})` : ''}`,
      },
    });
  }
  if (redeemed > 0) {
    await tx.user.update({ where: { id: userId }, data: { points: { increment: redeemed } } });
    await tx.pointTransaction.create({
      data: { userId, points: redeemed, type: 'REVERSE_REDEEM', note: `POS void ${invoiceNo}` },
    });
  }
}

export async function nextRefundNo(tx: Tx = prisma) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `RF-${y}${m}${d}-`;
  const last = await tx.posRefund.findFirst({
    where: { refundNo: { startsWith: prefix } },
    orderBy: { refundNo: 'desc' },
    select: { refundNo: true },
  });
  const seq = last ? Number(last.refundNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}
