import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, reversePoints } from '@/lib/pos';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const inv = await prisma.posInvoice.findUnique({
    where: { id },
    include: { payments: true, splits: true },
  });
  if (!inv) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (session.user.role !== 'ADMIN') {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const ownInvoice = inv.cashierId === session.user.id;
    const sameDay = inv.paidAt >= todayStart;
    if (!ownInvoice && !sameDay) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      const inv = await tx.posInvoice.findUnique({ where: { id } });
      if (!inv) throw new Error('NOT_FOUND');
      if (inv.status === 'VOID') throw new Error('ALREADY_VOID');
      if (inv.refundedAmount > 0) throw new Error('HAS_REFUND');

      // Reverse stock from itemsSnapshot
      const snap = (inv.itemsSnapshot as Array<{ productId: string; qty: number; productName?: string }> | null) || [];
      for (const it of snap) {
        await tx.posProduct.update({
          where: { id: it.productId },
          data: { stockQty: { increment: it.qty } },
        }).catch(() => {});
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

      // Reopen booking if any
      const bookingIds = (inv.bookingIds as string[] | null) || [];
      for (const bid of bookingIds) {
        await tx.booking.update({
          where: { id: bid },
          data: { paidAt: null, status: 'PENDING' },
        }).catch(() => {});
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
        where: { id, status: { not: 'VOID' }, refundedAmount: 0 },
        data: { status: 'VOID', voidedAt: new Date(), voidedBy: session.user.id, voidReason: reason },
      });
      if (upd.count !== 1) throw new Error('VOID_RACE');
    });
    prisma.auditLog
      .create({ data: { adminId: session.user.id, action: 'POS_INVOICE_VOID', targetId: id, details: { reason } } })
      .catch(() => {});
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
