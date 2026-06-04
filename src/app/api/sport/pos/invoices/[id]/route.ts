import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, reversePoints, audit } from '@/lib/pos';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const inv = await prisma.posInvoice.findUnique({
    where: { id },
    include: {
      payments: true,
      splits: true,
      linkedInvoices: { include: { payments: true, splits: true } },
      relatedInvoice: { select: { id: true, invoiceNo: true, type: true } },
    },
  });
  if (!inv) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (session.user.role !== 'ADMIN' && inv.cashierId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(inv);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = body.reason?.toString().slice(0, 500) || null;

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.posInvoice.findUnique({ where: { id } });
      if (!target) throw new Error('NOT_FOUND');
      if (target.status === 'VOID') throw new Error('ALREADY_VOID');

      // A sale may span two linked invoices (POS products + its raw BOOKING field charge,
      // joined by relatedInvoiceId). Voiding either one must void the whole sale group,
      // otherwise the unvoided side leaves live revenue / a paid booking behind.
      const groupIds = new Set<string>([id]);
      const parentId = target.relatedInvoiceId;
      if (parentId) {
        groupIds.add(parentId);
        const siblings = await tx.posInvoice.findMany({ where: { relatedInvoiceId: parentId }, select: { id: true } });
        for (const s of siblings) groupIds.add(s.id);
      }
      const children = await tx.posInvoice.findMany({ where: { relatedInvoiceId: id }, select: { id: true } });
      for (const c of children) groupIds.add(c.id);

      const group = await tx.posInvoice.findMany({ where: { id: { in: [...groupIds] } } });
      for (const g of group) {
        if (g.refundedAmount > 0) throw new Error('HAS_REFUND');
      }

      for (const inv of group) {
        if (inv.status === 'VOID') continue;

        // Reverse stock from itemsSnapshot. updateMany no-ops if the product was deleted
        // since the invoice was paid, instead of throwing (the prior .catch hid real DB errors).
        const snap = (inv.itemsSnapshot as Array<{ productId?: string; qty: number; productName?: string }> | null) || [];
        for (const it of snap) {
          if (!it.productId) continue;
          await tx.posProduct.updateMany({
            where: { id: it.productId },
            data: { stockQty: { increment: it.qty } },
          });
          await tx.posStockMovement.create({
            data: {
              productId: it.productId,
              type: 'VOID',
              qty: it.qty,
              refType: 'INVOICE_VOID',
              refId: inv.id,
              userId: session.user.id,
              note: reason,
            },
          });
        }

        // Reopen booking only if still APPROVED + paidAt matches (was paid via this invoice).
        // Skip if rebooked/cancelled to avoid silently regressing other state.
        const bookingIds = (inv.bookingIds as string[] | null) || [];
        for (const bid of bookingIds) {
          await tx.booking.updateMany({
            where: { id: bid, status: 'APPROVED', paidAt: { not: null } },
            data: { paidAt: null, status: 'PENDING' },
          });
        }

        if (inv.customerId && (inv.pointsEarned > 0 || inv.pointsRedeemed > 0)) {
          await reversePoints(tx, inv.customerId, inv.pointsEarned, inv.pointsRedeemed, inv.invoiceNo);
        }

        const couponMatch = inv.note?.match(/\[COUPON:([A-Z0-9_-]+)\s+-[\d.]+\]/);
        if (couponMatch) {
          await tx.coupon.updateMany({
            where: { code: couponMatch[1], usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }

        const upd = await tx.posInvoice.updateMany({
          where: { id: inv.id, status: { not: 'VOID' }, refundedAmount: 0 },
          data: { status: 'VOID', voidedAt: new Date(), voidedBy: session.user.id, voidReason: reason },
        });
        if (upd.count !== 1) throw new Error('VOID_RACE');
        // Audit inside tx: void + audit row commit atomically
        await audit(session.user.id, 'POS_INVOICE_VOID', inv.id, { reason, voidedWith: id }, tx);
      }
    }, { timeout: 20000 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'void failed';
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบบิล' }, { status: 404 });
    if (msg === 'ALREADY_VOID') return NextResponse.json({ error: 'บิล void ไปแล้ว' }, { status: 409 });
    if (msg === 'HAS_REFUND') return NextResponse.json({ error: 'บิลนี้มี refund แล้ว ต้อง refund เต็มจำนวนแทนการ void' }, { status: 409 });
    if (msg === 'VOID_RACE') return NextResponse.json({ error: 'บิลถูกแก้ไขโดยผู้ใช้อื่น' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
