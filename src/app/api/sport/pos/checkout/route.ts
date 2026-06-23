import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings, calcVat, nextInvoiceNo, getActiveShift, audit, earnPoints, redeemPoints } from '@/lib/pos';
import { calculatePriceWithRules, isCouponUsable, calculateCouponDiscount } from '@/lib/booking';
import { isCouponSystemEnabled } from '@/lib/settings';

type SplitInput = { label: string; amount: number; method: string; refNo?: string; target?: 'PRODUCT' | 'BOOKING' };
type PaymentInput = { method: string; amount?: number; cashReceived?: number; refNo?: string };

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tabId, includeBooking, discount, bookingDiscount, payment, splits, note, customer, pointsToRedeem, couponCode } = await req.json();
  if (!tabId) return NextResponse.json({ error: 'tabId required' }, { status: 400 });

  const redeemReq = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));

  const settings = await getPosSettings();

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
        // Sync snapshot from DB so the invoice reflects the actual customer record, not body inputs
        customerName = c.name?.slice(0, 200) || customerName;
        customerPhone = c.phone?.slice(0, 50) || customerPhone;
      }
      const master = await tx.posTab.findUnique({
        where: { id: tabId },
        include: {
          items: { where: { status: 'ACTIVE' } },
          children: {
            include: { items: { where: { status: 'ACTIVE' } } },
          },
        },
      });
      if (!master) throw new Error('TAB_NOT_FOUND');
      if (master.status !== 'OPEN') throw new Error('TAB_NOT_OPEN');

      const allTabs = [master, ...master.children];
      const allItems = allTabs.flatMap((t) => t.items.map((i) => ({ ...i, tabName: t.name })));

      const subtotalProduct = allItems.reduce(
        (s, i) => s + (i.unitPrice * i.qty - i.discount),
        0,
      );

      let subtotalBooking = 0;
      let bookingForUpdate: { id: string } | null = null;
      let bookingSnap: { bookingId: string; fieldId: string; fieldName: string; date: string; timeSlot: string; amount: number } | null = null;

      if (includeBooking && master.bookingId) {
        const booking = await tx.booking.findUnique({
          where: { id: master.bookingId },
          include: { field: { include: { priceRules: true } } },
        });
        if (booking && !booking.paidAt) {
          const [start, end] = booking.timeSlot.split('-');
          subtotalBooking = calculatePriceWithRules(start, end, booking.field.pricePerHour, booking.field.priceRules);
          if (booking.discountAmount) subtotalBooking = Math.max(subtotalBooking - booking.discountAmount, 0);
          subtotalBooking = +subtotalBooking.toFixed(2);
          bookingForUpdate = { id: booking.id };
          bookingSnap = { bookingId: booking.id, fieldId: booking.fieldId, fieldName: booking.field.name, date: booking.date.toISOString(), timeSlot: booking.timeSlot, amount: subtotalBooking };
        }
      }

      // Field (booking) revenue is stored on its own invoice at the raw subtotal.
      // Discount / coupon / service charge / VAT / points apply to products only.
      const discNum = Number(discount) || 0;
      if (!Number.isFinite(discNum) || discNum < 0) throw new Error('DISCOUNT_INVALID');

      let couponDiscount = 0;
      let appliedCouponCode: string | null = null;
      const rawCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase().slice(0, 50) : '';
      if (rawCode) {
        const couponEnabled = await isCouponSystemEnabled();
        if (!couponEnabled) throw new Error('COUPON_DISABLED');
        const c = await tx.coupon.findUnique({ where: { code: rawCode } });
        if (!c || !isCouponUsable(c)) throw new Error('COUPON_INVALID');
        const baseForCoupon = Math.max(subtotalProduct - discNum, 0);
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

      const itemsTotal = Math.max(subtotalProduct - combinedDiscount, 0);
      const scRate = settings.serviceChargeRate || 0;
      const serviceCharge = scRate > 0 ? +(itemsTotal * scRate / 100).toFixed(2) : 0;
      const vat = calcVat(itemsTotal + serviceCharge, settings.vatMode, settings.vatRate);

      const productIds = Array.from(new Set(allItems.map((i) => i.productId).filter((x): x is string => !!x)));
      const costMap = new Map<string, number>();
      if (productIds.length > 0) {
        const prods = await tx.posProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, cost: true } });
        for (const p of prods) costMap.set(p.id, p.cost);
      }
      const totalCost = +allItems.reduce((s, i) => s + (i.productId ? (costMap.get(i.productId) || 0) * i.qty : 0), 0).toFixed(2);

      // Loyalty redeem (member only) — capped by the product VAT total
      let pointsRedeemed = 0;
      let pointsRedeemValue = 0;
      if (redeemReq > 0 && customerId) {
        const ptValue = settings.pointsValueBaht || 0;
        if (ptValue <= 0) throw new Error('POINTS_REDEEM_DISABLED');
        const maxByVat = Math.floor(vat.total / ptValue);
        pointsRedeemed = Math.min(redeemReq, maxByVat);
        pointsRedeemValue = +(pointsRedeemed * ptValue).toFixed(2);
      }
      const posFinalTotal = +Math.max(vat.total - pointsRedeemValue, 0).toFixed(2);
      // Field-charge discount applies to the booking invoice only (capped to its subtotal).
      const bookDisc = Number(bookingDiscount) || 0;
      if (!Number.isFinite(bookDisc) || bookDisc < 0) throw new Error('BOOKING_DISCOUNT_INVALID');
      const bookingDiscApplied = Math.min(bookDisc, subtotalBooking);
      const bookingTotal = +Math.max(subtotalBooking - bookingDiscApplied, 0).toFixed(2);
      const grandTotal = +(posFinalTotal + bookingTotal).toFixed(2);

      // Payment validation (against the combined amount collected from the customer)
      if (Array.isArray(splits) && splits.length > 0) {
        const sumSplit = (splits as SplitInput[]).reduce((s, x) => s + Number(x.amount), 0);
        if (!Number.isFinite(sumSplit) || Math.abs(sumSplit - grandTotal) > 0.01) throw new Error('SPLIT_MISMATCH');
      } else {
        if (!payment) throw new Error('PAYMENT_REQUIRED');
        const p = payment as PaymentInput;
        if (!['CASH', 'TRANSFER', 'QR', 'QR_FIELD', 'CARD', 'OTHER'].includes(p.method)) throw new Error('PAYMENT_METHOD_INVALID');
        if (p.method === 'CASH' && p.cashReceived !== undefined && Number(p.cashReceived) < grandTotal) {
          throw new Error('CASH_INSUFFICIENT');
        }
      }

      const activeShift = await getActiveShift(session.user.id, tx);
      if (settings.requireShift && !activeShift) throw new Error('SHIFT_REQUIRED');

      const earnRate = settings.pointsEarnPerBaht || 0;
      const pointsEarned = customerId && earnRate > 0 ? Math.floor(posFinalTotal * earnRate) : 0;

      const custFields = { cashierId: session.user.id, shiftId: activeShift?.id || null, customerId, customerName, customerTaxId, customerAddress, customerPhone };
      const tabIdList = allTabs.map((t) => t.id);

      async function createInvoice(data: Record<string, unknown>) {
        let attempts = 0;
        while (true) {
          const invoiceNo = await nextInvoiceNo(tx);
          try {
            return await tx.posInvoice.create({ data: { invoiceNo, status: 'PAID', refundedAmount: 0, ...custFields, ...data } as never });
          } catch (e) {
            attempts++;
            if (attempts > 5) throw e;
          }
        }
      }

      const hasProducts = allItems.length > 0;
      const hasBooking = !!bookingForUpdate && bookingTotal > 0;

      // POS invoice carries products + all derived charges. Created unless this is a booking-only sale.
      let posInvoice: { id: string; invoiceNo: string } | null = null;
      if (hasProducts || !hasBooking) {
        posInvoice = await createInvoice({
          type: 'POS_TAB',
          subtotalProduct, subtotalBooking: 0, discount: combinedDiscount,
          vatMode: settings.vatMode, vatRate: settings.vatRate, vatAmount: vat.vatAmount, total: posFinalTotal,
          serviceCharge, totalCost,
          pointsEarned, pointsRedeemed, pointsRedeemValue,
          tabIds: tabIdList,
          itemsSnapshot: allItems.map((i) => ({ tabName: i.tabName, productId: i.productId, productName: i.productName, qty: i.qty, unitPrice: i.unitPrice, discount: i.discount })),
          note: (() => {
            const base = note?.toString().slice(0, 400) || '';
            if (!appliedCouponCode) return base || null;
            const tag = `[COUPON:${appliedCouponCode} -${couponDiscount.toFixed(2)}]`;
            return (base ? `${base} ${tag}` : tag).slice(0, 500);
          })(),
        });
      }

      // Booking invoice carries the field charge (gross subtotal + discount + net total),
      // linked back to the POS invoice as its source.
      let bookingInvoice: { id: string; invoiceNo: string } | null = null;
      if (hasBooking) {
        bookingInvoice = await createInvoice({
          type: 'BOOKING',
          subtotalProduct: 0, subtotalBooking, discount: bookingDiscApplied,
          vatMode: 'NONE', vatRate: 0, vatAmount: 0, total: bookingTotal,
          serviceCharge: 0, totalCost: 0,
          pointsEarned: 0, pointsRedeemed: 0, pointsRedeemValue: 0,
          tabIds: tabIdList,
          bookingIds: [bookingSnap!.bookingId],
          itemsSnapshot: [bookingSnap],
          relatedInvoiceId: posInvoice?.id ?? null,
        });
      }

      const posId = posInvoice?.id ?? null;
      const bookId = bookingInvoice?.id ?? null;
      type Method = 'CASH' | 'TRANSFER' | 'QR' | 'QR_FIELD' | 'CARD' | 'OTHER';
      const clean = (s: string | null) => (s == null ? null : String(s).slice(0, 100));
      const pay = (invoiceId: string, method: Method, amount: number, cashReceived: number | null, changeAmount: number | null, refNo: string | null) =>
        tx.posPayment.create({ data: { invoiceId, method, amount: +amount.toFixed(2), cashReceived, changeAmount, refNo: clean(refNo) } });
      const splitRow = (invoiceId: string, label: string, amount: number, method: Method, refNo: string | null) =>
        tx.posInvoiceSplit.create({ data: { invoiceId, label: String(label).slice(0, 100), amount: +amount.toFixed(2), method, refNo: clean(refNo) } });
      if (Array.isArray(splits) && splits.length > 0) {
        const splitList = splits as SplitInput[];
        const useTargets = !!bookId && !!posId && splitList.some((s) => s.target === 'BOOKING' || s.target === 'PRODUCT');
        if (useTargets) {
          // Per-line target: each split is paid directly to the field (BOOKING) or product (POS) invoice.
          let bookSum = 0, prodSum = 0;
          for (const sp of splitList) {
            if (!['CASH', 'TRANSFER', 'QR', 'QR_FIELD', 'CARD', 'OTHER'].includes(sp.method)) throw new Error('PAYMENT_METHOD_INVALID');
            const method = sp.method as Method;
            const amt = +Number(sp.amount).toFixed(2);
            if (!Number.isFinite(amt) || amt < 0) throw new Error('SPLIT_AMOUNT_INVALID');
            if (amt <= 0.0001) continue;
            const toBooking = sp.target === 'BOOKING';
            const target = toBooking ? bookId! : posId!;
            await splitRow(target, sp.label, amt, method, sp.refNo || null);
            await pay(target, method, amt, null, null, null);
            if (toBooking) bookSum = +(bookSum + amt).toFixed(2); else prodSum = +(prodSum + amt).toFixed(2);
          }
          if (Math.abs(bookSum - bookingTotal) > 0.01) throw new Error('SPLIT_BOOKING_MISMATCH');
          if (Math.abs(prodSum - posFinalTotal) > 0.01) throw new Error('SPLIT_PRODUCT_MISMATCH');
        } else {
          // Allocate booking-first: fill the booking invoice, remainder goes to the POS invoice.
          let remBooking = bookId ? bookingTotal : 0;
          for (const sp of splitList) {
            if (!['CASH', 'TRANSFER', 'QR', 'QR_FIELD', 'CARD', 'OTHER'].includes(sp.method)) throw new Error('PAYMENT_METHOD_INVALID');
            const method = sp.method as Method;
            let amt = Number(sp.amount);
            if (!Number.isFinite(amt) || amt < 0) throw new Error('SPLIT_AMOUNT_INVALID');
            if (remBooking > 0.0001 && bookId) {
              const toBook = Math.min(amt, remBooking);
              await splitRow(bookId, sp.label, toBook, method, sp.refNo || null);
              await pay(bookId, method, toBook, null, null, null);
              remBooking = +(remBooking - toBook).toFixed(2);
              amt = +(amt - toBook).toFixed(2);
            }
            if (amt > 0.0001) {
              const target = posId ?? bookId!;
              await splitRow(target, sp.label, amt, method, sp.refNo || null);
              await pay(target, method, amt, null, null, null);
            }
          }
        }
      } else {
        const p = payment as PaymentInput;
        const method = p.method as Method;
        const cashReceived = method === 'CASH' && p.cashReceived !== undefined ? Number(p.cashReceived) : null;
        const changeAmount = cashReceived !== null ? +(cashReceived - grandTotal).toFixed(2) : null;
        if (posId && bookId) {
          // Record both the field charge and the products under the exact method the cashier
          // selected — no auto QR -> QR_FIELD. To send the field charge to the company QR
          // account, pick "QR สนาม" (or split per line).
          await pay(bookId, method, bookingTotal, null, null, null);
          await pay(posId, method, posFinalTotal, cashReceived, changeAmount, p.refNo || null);
        } else if (posId) {
          await pay(posId, method, posFinalTotal, cashReceived, changeAmount, p.refNo || null);
        } else {
          await pay(bookId!, method, bookingTotal, cashReceived, changeAmount, p.refNo || null);
        }
      }

      if (posInvoice && customerId && pointsRedeemed > 0) {
        await redeemPoints(tx, customerId, pointsRedeemed, posInvoice.invoiceNo);
      }
      if (posInvoice && customerId && pointsEarned > 0) {
        await earnPoints(tx, customerId, pointsEarned, posInvoice.invoiceNo);
      }

      // Close tabs (atomic guard: only if still open/merged)
      const closed = await tx.posTab.updateMany({
        where: { id: { in: tabIdList }, status: { in: ['OPEN', 'MERGED'] } },
        data: { status: 'PAID', closedAt: new Date() },
      });
      if (closed.count !== allTabs.length) throw new Error('TAB_RACE');

      // Mark booking as paid (atomic guard: only if not yet paid)
      if (bookingForUpdate) {
        const bUpd = await tx.booking.updateMany({
          where: { id: bookingForUpdate.id, paidAt: null },
          data: { status: 'APPROVED', paidAt: new Date() },
        });
        if (bUpd.count !== 1) throw new Error('BOOKING_RACE');
      }

      const primary = posInvoice ?? bookingInvoice!;
      return { id: primary.id, invoiceNo: primary.invoiceNo, total: grandTotal, shiftId: activeShift?.id || null, posInvoiceId: posId, bookingInvoiceId: bookId };
    }, { timeout: 20000 });
    audit(session.user.id, 'POS_CHECKOUT', result.id, { invoiceNo: result.invoiceNo, total: result.total, shiftId: result.shiftId, posInvoiceId: result.posInvoiceId, bookingInvoiceId: result.bookingInvoiceId });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'checkout failed';
    if (msg === 'SHIFT_REQUIRED') return NextResponse.json({ error: 'ต้องเปิดกะก่อนขาย' }, { status: 409 });
    if (msg === 'DISCOUNT_INVALID') return NextResponse.json({ error: 'ส่วนลดไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'BOOKING_DISCOUNT_INVALID') return NextResponse.json({ error: 'ส่วนลดค่าสนามไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'POINTS_INSUFFICIENT') return NextResponse.json({ error: 'แต้มไม่พอ' }, { status: 400 });
    if (msg === 'POINTS_REDEEM_DISABLED') return NextResponse.json({ error: 'ระบบ redeem ปิดอยู่' }, { status: 400 });
    if (msg === 'SPLIT_MISMATCH') return NextResponse.json({ error: 'ผลรวม split ไม่เท่ากับยอดบิล' }, { status: 400 });
    if (msg === 'SPLIT_AMOUNT_INVALID') return NextResponse.json({ error: 'จำนวนเงิน split ไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'SPLIT_BOOKING_MISMATCH') return NextResponse.json({ error: 'ยอด split ค่าสนามไม่เท่ากับค่าสนาม' }, { status: 400 });
    if (msg === 'SPLIT_PRODUCT_MISMATCH') return NextResponse.json({ error: 'ยอด split สินค้าไม่เท่ากับยอดสินค้า' }, { status: 400 });
    if (msg === 'CASH_INSUFFICIENT') return NextResponse.json({ error: 'เงินสดไม่พอ' }, { status: 400 });
    if (msg === 'COUPON_DISABLED') return NextResponse.json({ error: 'ระบบคูปองปิดอยู่' }, { status: 403 });
    if (msg === 'COUPON_INVALID') return NextResponse.json({ error: 'คูปองไม่ถูกต้องหรือหมดอายุ' }, { status: 400 });
    if (msg === 'CUSTOMER_INVALID') return NextResponse.json({ error: 'ลูกค้าไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'TAB_NOT_OPEN') return NextResponse.json({ error: 'tab ปิดแล้ว' }, { status: 409 });
    if (msg === 'TAB_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบ tab' }, { status: 404 });
    if (msg === 'TAB_RACE') return NextResponse.json({ error: 'tab ถูกปิดโดยอีกหน้าจอ' }, { status: 409 });
    if (msg === 'BOOKING_RACE') return NextResponse.json({ error: 'booking ถูกจ่ายไปแล้ว' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
