import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings, calcVat, nextInvoiceNo, getActiveShift, audit, earnPoints, redeemPoints } from '@/lib/pos';
import { isCouponUsable, calculateCouponDiscount } from '@/lib/booking';
import { isCouponSystemEnabled } from '@/lib/settings';

type Item = { productId: string; qty: number; unitPrice?: number; discount?: number };

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { items, payment, splits, discount, note, customer, pointsToRedeem, couponCode } = await req.json();
  const redeemReq = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items required' }, { status: 400 });
  }
  const PAY_METHODS = ['CASH', 'TRANSFER', 'QR', 'QR_FIELD', 'CARD', 'OTHER'];
  const hasSplits = Array.isArray(splits) && splits.length > 0;
  if (!hasSplits && (!payment || !PAY_METHODS.includes(payment.method))) {
    return NextResponse.json({ error: 'payment.method invalid' }, { status: 400 });
  }

  const isAdmin = session.user.role === 'ADMIN';
  // Only ADMIN may override unit price; cashiers always sell at the product's price.
  if (!isAdmin && (items as Item[]).some((it) => it.unitPrice !== undefined)) {
    return NextResponse.json({ error: 'unitPrice override ต้องเป็น ADMIN' }, { status: 403 });
  }

  const settings = await getPosSettings();
  const allowNegative = settings.allowNegativeStock;

  const cust = customer && typeof customer === 'object' ? customer : null;
  const customerId = cust?.id ? String(cust.id).slice(0, 50) : null;
  // For guest customers (no id), accept body fields. For known customers, body is overridden
  // with DB values inside the tx so cashier UI can't fake another user's snapshot.
  let customerName = cust?.name ? String(cust.name).slice(0, 200) : null;
  const customerTaxId = cust?.taxId ? String(cust.taxId).slice(0, 50) : null;
  const customerAddress = cust?.address ? String(cust.address).slice(0, 500) : null;
  let customerPhone = cust?.phone ? String(cust.phone).slice(0, 50) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (customerId) {
        const c = await tx.user.findUnique({
          where: { id: customerId },
          select: { id: true, role: true, name: true, phone: true },
        });
        if (!c || c.role !== 'USER') throw new Error('CUSTOMER_INVALID');
        customerName = c.name?.slice(0, 200) || customerName;
        customerPhone = c.phone?.slice(0, 50) || customerPhone;
      }
      const ids = (items as Item[]).map((i) => i.productId);
      const products = await tx.posProduct.findMany({ where: { id: { in: ids } } });
      const map = new Map(products.map((p) => [p.id, p]));

      let itemsTotal = 0;
      let totalCost = 0;
      const snapshot: Array<{ productId: string; productName: string; qty: number; unitPrice: number; discount: number }> = [];
      const pendingMovements: Array<{ productId: string; qty: number }> = [];
      for (const it of items as Item[]) {
        const p = map.get(it.productId);
        if (!p || p.deletedAt) throw new Error('PRODUCT_NOT_FOUND');
        if (!p.isActive) throw new Error('PRODUCT_INACTIVE');
        const q = Number(it.qty);
        if (!Number.isInteger(q) || q <= 0) throw new Error('QTY_INVALID');
        const unitPrice = it.unitPrice !== undefined ? Number(it.unitPrice) : p.price;
        const lineDiscount = Number(it.discount) || 0;
        if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000) throw new Error('PRICE_INVALID');
        if (!Number.isFinite(lineDiscount) || lineDiscount < 0 || lineDiscount > 1_000_000) throw new Error('DISCOUNT_INVALID');
        const line = Math.max(0, unitPrice * q - lineDiscount);
        itemsTotal += line;
        totalCost += (p.cost || 0) * q;
        snapshot.push({ productId: p.id, productName: p.name, qty: q, unitPrice, discount: lineDiscount });

        // Resolve stock-variant (pack) to its base product and multiply.
        const stockTargetId = p.stockParentId ?? p.id;
        const stockMult = p.stockParentId && p.unitsPerStock && p.unitsPerStock > 0 ? p.unitsPerStock : 1;
        const need = q * stockMult;
        if (allowNegative) {
          await tx.posProduct.update({ where: { id: stockTargetId }, data: { stockQty: { decrement: need } } });
        } else {
          const r = await tx.posProduct.updateMany({
            where: { id: stockTargetId, stockQty: { gte: need } },
            data: { stockQty: { decrement: need } },
          });
          if (r.count === 0) throw new Error(`STOCK_INSUFFICIENT:${p.name}`);
        }
        pendingMovements.push({ productId: stockTargetId, qty: need });
      }

      const discNum = Math.max(0, Number(discount) || 0);

      let couponDiscount = 0;
      let appliedCouponCode: string | null = null;
      const rawCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase().slice(0, 50) : '';
      if (rawCode) {
        const couponEnabled = await isCouponSystemEnabled();
        if (!couponEnabled) throw new Error('COUPON_DISABLED');
        const c = await tx.coupon.findUnique({ where: { code: rawCode } });
        if (!c || !isCouponUsable(c)) throw new Error('COUPON_INVALID');
        const baseForCoupon = Math.max(itemsTotal - discNum, 0);
        couponDiscount = calculateCouponDiscount({ discountType: c.discountType, discountValue: c.discountValue }, baseForCoupon);
        if (couponDiscount > 0) {
          const upd = await tx.$executeRaw`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1
            WHERE code = ${rawCode} AND "isActive" = true
            AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
            AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          `;
          if (upd === 0) throw new Error('COUPON_INVALID');
          appliedCouponCode = rawCode;
        }
      }
      const combinedDiscount = +(discNum + couponDiscount).toFixed(2);

      const baseTotal = Math.max(itemsTotal - combinedDiscount, 0);
      const scRate = settings.serviceChargeRate || 0;
      const serviceCharge = scRate > 0 ? +(baseTotal * scRate / 100).toFixed(2) : 0;
      const vat = calcVat(baseTotal + serviceCharge, settings.vatMode, settings.vatRate);

      let pointsRedeemed = 0;
      let pointsRedeemValue = 0;
      if (redeemReq > 0 && customerId) {
        const ptValue = settings.pointsValueBaht || 0;
        if (ptValue <= 0) throw new Error('POINTS_REDEEM_DISABLED');
        const maxByVat = Math.floor(vat.total / ptValue);
        pointsRedeemed = Math.min(redeemReq, maxByVat);
        pointsRedeemValue = +(pointsRedeemed * ptValue).toFixed(2);
      }
      const finalTotal = +Math.max(vat.total - pointsRedeemValue, 0).toFixed(2);

      const activeShift = await getActiveShift(session.user.id, tx);
      if (settings.requireShift && !activeShift) throw new Error('SHIFT_REQUIRED');

      const earnRate = settings.pointsEarnPerBaht || 0;
      const pointsEarned = customerId && earnRate > 0 ? Math.floor(finalTotal * earnRate) : 0;

      let invoice;
      let attempts = 0;
      while (true) {
        const invoiceNo = await nextInvoiceNo(tx);
        try {
          invoice = await tx.posInvoice.create({
            data: {
              invoiceNo,
              type: 'POS_QUICK',
              status: 'PAID',
              subtotalProduct: itemsTotal,
              subtotalBooking: 0,
              discount: combinedDiscount,
              vatMode: settings.vatMode,
              vatRate: settings.vatRate,
              vatAmount: vat.vatAmount,
              total: finalTotal,
              serviceCharge, totalCost: +totalCost.toFixed(2),
              pointsEarned, pointsRedeemed, pointsRedeemValue,
              cashierId: session.user.id,
              shiftId: activeShift?.id || null,
              customerId, customerName, customerTaxId, customerAddress, customerPhone,
              itemsSnapshot: snapshot as unknown as object,
              note: (() => {
                const base = note?.toString().slice(0, 400) || '';
                if (!appliedCouponCode) return base || null;
                const tag = `[COUPON:${appliedCouponCode} -${couponDiscount.toFixed(2)}]`;
                return (base ? `${base} ${tag}` : tag).slice(0, 500);
              })(),
            },
          });
          break;
        } catch (e) {
          attempts++;
          if (attempts > 5) throw e;
        }
      }
      if (hasSplits) {
        // cash+qr (or any multi-method) single bill: one payment + split row per line.
        let sum = 0;
        for (const sp of splits as Array<{ label?: string; amount: number; method: string }>) {
          if (!PAY_METHODS.includes(sp.method)) throw new Error('PAYMENT_METHOD_INVALID');
          const amt = +Number(sp.amount).toFixed(2);
          if (!Number.isFinite(amt) || amt < 0) throw new Error('SPLIT_AMOUNT_INVALID');
          if (amt <= 0.0001) continue;
          await tx.posInvoiceSplit.create({ data: { invoiceId: invoice.id, label: String(sp.label || '').slice(0, 100), amount: amt, method: sp.method as 'CASH' | 'TRANSFER' | 'QR' | 'QR_FIELD' | 'CARD' | 'OTHER' } });
          await tx.posPayment.create({ data: { invoiceId: invoice.id, method: sp.method as 'CASH' | 'TRANSFER' | 'QR' | 'QR_FIELD' | 'CARD' | 'OTHER', amount: amt, cashReceived: null, changeAmount: null, refNo: null } });
          sum = +(sum + amt).toFixed(2);
        }
        if (Math.abs(sum - finalTotal) > 0.01) throw new Error('SPLIT_MISMATCH');
      } else {
        const cashReceived = payment.method === 'CASH' && payment.cashReceived !== undefined ? Number(payment.cashReceived) : null;
        const changeAmount = cashReceived !== null ? +(cashReceived - finalTotal).toFixed(2) : null;
        if (payment.method === 'CASH' && cashReceived !== null && cashReceived < finalTotal) {
          throw new Error('CASH_INSUFFICIENT');
        }
        await tx.posPayment.create({
          data: {
            invoiceId: invoice.id,
            method: payment.method,
            amount: finalTotal,
            cashReceived,
            changeAmount,
            refNo: payment.refNo || null,
          },
        });
      }

      if (customerId && pointsRedeemed > 0) await redeemPoints(tx, customerId, pointsRedeemed, invoice.invoiceNo);
      if (customerId && pointsEarned > 0) await earnPoints(tx, customerId, pointsEarned, invoice.invoiceNo);

      for (const m of pendingMovements) {
        await tx.posStockMovement.create({
          data: {
            productId: m.productId,
            type: 'SALE',
            qty: -m.qty,
            refType: 'QUICK_SALE',
            refId: invoice.id,
            userId: session.user.id,
          },
        });
      }

      return invoice;
    });
    audit(session.user.id, 'POS_QUICK_SALE', result.id, { invoiceNo: result.invoiceNo, total: result.total, shiftId: result.shiftId });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'quick-sale failed';
    if (msg === 'SHIFT_REQUIRED') return NextResponse.json({ error: 'ต้องเปิดกะก่อนขาย' }, { status: 409 });
    if (msg === 'POINTS_INSUFFICIENT') return NextResponse.json({ error: 'แต้มไม่พอ' }, { status: 400 });
    if (msg === 'POINTS_REDEEM_DISABLED') return NextResponse.json({ error: 'ระบบ redeem ปิดอยู่' }, { status: 400 });
    if (msg.startsWith('STOCK_INSUFFICIENT')) return NextResponse.json({ error: `สต็อกไม่พอ: ${msg.split(':')[1]}` }, { status: 409 });
    if (msg === 'CASH_INSUFFICIENT') return NextResponse.json({ error: 'เงินสดไม่พอ' }, { status: 400 });
    if (msg === 'PAYMENT_METHOD_INVALID') return NextResponse.json({ error: 'วิธีจ่ายไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'SPLIT_AMOUNT_INVALID') return NextResponse.json({ error: 'จำนวนเงิน split ไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'SPLIT_MISMATCH') return NextResponse.json({ error: 'ผลรวม split ไม่เท่ากับยอดบิล' }, { status: 400 });
    if (msg === 'COUPON_DISABLED') return NextResponse.json({ error: 'ระบบคูปองปิดอยู่' }, { status: 403 });
    if (msg === 'COUPON_INVALID') return NextResponse.json({ error: 'คูปองไม่ถูกต้องหรือหมดอายุ' }, { status: 400 });
    if (msg === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบสินค้า (อาจถูกลบ)' }, { status: 404 });
    if (msg === 'PRODUCT_INACTIVE') return NextResponse.json({ error: 'สินค้าปิดขาย' }, { status: 409 });
    if (msg === 'QTY_INVALID') return NextResponse.json({ error: 'qty ไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'PRICE_INVALID') return NextResponse.json({ error: 'ราคาไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'DISCOUNT_INVALID') return NextResponse.json({ error: 'ส่วนลดไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'CUSTOMER_INVALID') return NextResponse.json({ error: 'ลูกค้าไม่ถูกต้อง' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
