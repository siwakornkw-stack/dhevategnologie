import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getActiveShift, nextRefundNo, audit, reversePoints, applyStock } from '@/lib/pos';

type RefundLine = { productId: string; productName?: string; qty: number; unitPrice: number };

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get('invoiceId');
  const shiftId = searchParams.get('shiftId');
  const where: Record<string, unknown> = {};
  if (invoiceId) where.invoiceId = invoiceId;
  if (shiftId) where.shiftId = shiftId;
  // Scope CASHIER to their own refunds; ADMIN sees all
  if (session.user.role === 'CASHIER') where.cashierId = session.user.id;

  const refunds = await prisma.posRefund.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(refunds);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const invoiceId = String(body.invoiceId || '').trim();
  const method = String(body.method || '').trim();
  const amount = Number(body.amount);
  const reason = body.reason?.toString().slice(0, 500) || null;
  const items = Array.isArray(body.items) ? (body.items as RefundLine[]) : [];

  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
  if (!['CASH', 'TRANSFER', 'QR', 'QR_FIELD', 'CARD', 'OTHER'].includes(method)) {
    return NextResponse.json({ error: 'method invalid' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount invalid' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const inv = await tx.posInvoice.findUnique({ where: { id: invoiceId } });
      if (!inv) throw new Error('INVOICE_NOT_FOUND');
      if (inv.status !== 'PAID') throw new Error('INVOICE_NOT_PAID');

      const cleanItems: RefundLine[] = [];
      for (const it of items) {
        const qty = Number(it.qty);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        if (!it.productId) continue;
        cleanItems.push({
          productId: String(it.productId),
          productName: it.productName ? String(it.productName).slice(0, 200) : undefined,
          qty,
          unitPrice: Number(it.unitPrice) || 0,
        });
      }

      // Validate products exist BEFORE any mutation
      if (cleanItems.length) {
        const ids = cleanItems.map((i) => i.productId);
        const found = await tx.posProduct.findMany({ where: { id: { in: ids } }, select: { id: true } });
        const foundIds = new Set(found.map((p) => p.id));
        for (const it of cleanItems) {
          if (!foundIds.has(it.productId)) throw new Error('PRODUCT_NOT_FOUND');
        }

        // Block per-line over-refund: prior refunded qty + new qty must not exceed original qty
        const origSnap = (inv.itemsSnapshot as Array<{ productId?: string; qty: number }> | null) || [];
        const origQty = new Map<string, number>();
        for (const o of origSnap) {
          if (!o.productId) continue;
          origQty.set(o.productId, (origQty.get(o.productId) || 0) + (Number(o.qty) || 0));
        }
        const priorRefunds = await tx.posRefund.findMany({
          where: { invoiceId: inv.id },
          select: { itemsSnapshot: true },
        });
        const refundedQty = new Map<string, number>();
        for (const pr of priorRefunds) {
          const snap = (pr.itemsSnapshot as Array<{ productId?: string; qty: number }> | null) || [];
          for (const s of snap) {
            if (!s.productId) continue;
            refundedQty.set(s.productId, (refundedQty.get(s.productId) || 0) + (Number(s.qty) || 0));
          }
        }
        const newQty = new Map<string, number>();
        for (const it of cleanItems) {
          newQty.set(it.productId, (newQty.get(it.productId) || 0) + it.qty);
        }
        for (const [pid, nq] of newQty) {
          const orig = origQty.get(pid) || 0;
          const prev = refundedQty.get(pid) || 0;
          if (prev + nq > orig) throw new Error(`REFUND_QTY_EXCEEDS:${pid}`);
        }

        // Item-level refund: cash refunded must not exceed the value of the returned items.
        const itemsValue = cleanItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
        if (amount > itemsValue + 0.01) throw new Error('REFUND_AMOUNT_EXCEEDS_ITEMS');
      }

      // Atomic guard: refundedAmount + amount must not exceed total.
      // No positive tolerance — tolerance on the upper bound would allow
      // total refunds to exceed the invoice amount under repeated rounding.
      const guard = await tx.posInvoice.updateMany({
        where: {
          id: inv.id,
          status: 'PAID',
          refundedAmount: { lte: inv.total - amount },
        },
        data: { refundedAmount: { increment: amount } },
      });
      if (guard.count !== 1) throw new Error('REFUND_EXCEEDS');

      // If this refund pushes refundedAmount to exactly inv.total, release the coupon hold
      // once. The atomic guard above ensures we only enter this branch the single tx that
      // crosses the threshold, so no double-decrement.
      // Use raw sum (not toFixed) — toFixed rounds, but the atomic guard above
      // already bounds newRefunded <= inv.total exactly. Comparing the raw sum
      // avoids spurious threshold crossing from rounding artifacts.
      const newRefunded = inv.refundedAmount + amount;
      if (newRefunded >= inv.total) {
        const couponMatch = inv.note?.match(/\[COUPON:([A-Z0-9_-]+)\s+-[\d.]+\]/);
        if (couponMatch) {
          await tx.coupon.updateMany({
            where: { code: couponMatch[1], usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }

      // Ratio-based points reverse (idempotent via pointTransaction history)
      if (inv.customerId && (inv.pointsEarned > 0 || inv.pointsRedeemed > 0) && inv.total > 0) {
        const newRefunded = inv.refundedAmount + amount;
        const ratio = Math.min(1, newRefunded / inv.total);
        const targetEarnRev = Math.floor(inv.pointsEarned * ratio);
        const targetRedeemRet = Math.floor(inv.pointsRedeemed * ratio);
        const prior = await tx.pointTransaction.findMany({
          where: { userId: inv.customerId, note: { contains: inv.invoiceNo }, type: { in: ['REVERSE_EARN', 'REVERSE_REDEEM'] } },
          select: { points: true, type: true },
        });
        let priorEarnRev = 0;
        let priorRedeemRet = 0;
        for (const p of prior) {
          if (p.type === 'REVERSE_EARN') priorEarnRev += -p.points;
          else if (p.type === 'REVERSE_REDEEM') priorRedeemRet += p.points;
        }
        const earnNow = Math.max(0, targetEarnRev - priorEarnRev);
        const redeemNow = Math.max(0, targetRedeemRet - priorRedeemRet);
        if (earnNow > 0 || redeemNow > 0) {
          await reversePoints(tx, inv.customerId, earnNow, redeemNow, inv.invoiceNo);
        }
      }

      for (const it of cleanItems) {
        await applyStock(tx, it.productId, it.qty, { type: 'IN', refType: 'REFUND', refId: inv.id, userId: session.user.id, note: reason, allowNegative: true });
      }

      const activeShift = await getActiveShift(session.user.id, tx);

      let refund;
      let attempts = 0;
      while (true) {
        const refundNo = await nextRefundNo(tx);
        try {
          refund = await tx.posRefund.create({
            data: {
              refundNo,
              invoiceId: inv.id,
              shiftId: activeShift?.id || null,
              cashierId: session.user.id,
              method: method as 'CASH' | 'TRANSFER' | 'QR' | 'QR_FIELD' | 'CARD' | 'OTHER',
              amount,
              reason,
              itemsSnapshot: cleanItems.length ? cleanItems : undefined,
            },
          });
          break;
        } catch (e) {
          attempts++;
          if (attempts > 5) throw e;
        }
      }

      // Audit inside tx so refund + audit row are atomic
      await audit(session.user.id, 'POS_REFUND', refund.id, { invoiceId, amount, method, reason }, tx);
      return refund;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'refund failed';
    if (msg === 'INVOICE_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบบิล' }, { status: 404 });
    if (msg === 'INVOICE_NOT_PAID') return NextResponse.json({ error: 'บิลไม่อยู่สถานะ PAID' }, { status: 409 });
    if (msg === 'REFUND_EXCEEDS') return NextResponse.json({ error: 'เกินยอดคงเหลือของบิล' }, { status: 400 });
    if (msg === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบสินค้าใน refund' }, { status: 404 });
    if (msg.startsWith('REFUND_QTY_EXCEEDS')) return NextResponse.json({ error: 'จำนวนคืนเกินที่ขาย (รวม refund ก่อนหน้า)' }, { status: 400 });
    if (msg === 'REFUND_AMOUNT_EXCEEDS_ITEMS') return NextResponse.json({ error: 'ยอดคืนเกินมูลค่าสินค้าที่เลือกคืน' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
