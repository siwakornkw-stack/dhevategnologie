import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings, calcVat, nextInvoiceNo, getActiveShift, audit, earnPoints, redeemPoints } from '@/lib/pos';
import { calculatePriceWithRules, isCouponUsable, calculateCouponDiscount } from '@/lib/booking';
import { isCouponSystemEnabled } from '@/lib/settings';

type SplitInput = { label: string; amount: number; method: string; refNo?: string };
type PaymentInput = { method: string; amount?: number; cashReceived?: number; refNo?: string };

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tabId, includeBooking, discount, payment, splits, note, customer, pointsToRedeem, couponCode } = await req.json();
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
      let bookingIds: string[] = [];
      let bookingForUpdate: { id: string } | null = null;

      if (includeBooking && master.bookingId) {
        const booking = await tx.booking.findUnique({
          where: { id: master.bookingId },
          include: { field: { include: { priceRules: true } } },
        });
        if (booking && !booking.paidAt) {
          const [start, end] = booking.timeSlot.split('-');
          subtotalBooking = calculatePriceWithRules(start, end, booking.field.pricePerHour, booking.field.priceRules);
          if (booking.discountAmount) subtotalBooking = Math.max(subtotalBooking - booking.discountAmount, 0);
          bookingForUpdate = { id: booking.id };
          bookingIds = [booking.id];
        }
      }

      const discNum = Number(discount) || 0;
      if (!Number.isFinite(discNum) || discNum < 0) throw new Error('DISCOUNT_INVALID');
      const subtotalAll = subtotalProduct + subtotalBooking;

      let couponDiscount = 0;
      let appliedCouponCode: string | null = null;
      const rawCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase().slice(0, 50) : '';
      if (rawCode) {
        const couponEnabled = await isCouponSystemEnabled();
        if (!couponEnabled) throw new Error('COUPON_DISABLED');
        const c = await tx.coupon.findUnique({ where: { code: rawCode } });
        if (!c || !isCouponUsable(c)) throw new Error('COUPON_INVALID');
        const baseForCoupon = Math.max(subtotalAll - discNum, 0);
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

      const itemsTotal = Math.max(subtotalAll - combinedDiscount, 0);
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

      // Loyalty redeem (member only)
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

      // Payment validation
      if (Array.isArray(splits) && splits.length > 0) {
        const sumSplit = (splits as SplitInput[]).reduce((s, x) => s + Number(x.amount), 0);
        if (Math.abs(sumSplit - finalTotal) > 0.01) throw new Error('SPLIT_MISMATCH');
      } else {
        if (!payment) throw new Error('PAYMENT_REQUIRED');
        const p = payment as PaymentInput;
        if (!['CASH', 'TRANSFER', 'QR', 'CARD', 'OTHER'].includes(p.method)) throw new Error('PAYMENT_METHOD_INVALID');
        if (p.method === 'CASH' && p.cashReceived !== undefined && Number(p.cashReceived) < finalTotal) {
          throw new Error('CASH_INSUFFICIENT');
        }
      }

      const type = subtotalBooking > 0 && subtotalProduct > 0 ? 'MIXED' : subtotalBooking > 0 ? 'BOOKING' : 'POS_TAB';

      const activeShift = await getActiveShift(session.user.id, tx);
      if (settings.requireShift && !activeShift) throw new Error('SHIFT_REQUIRED');

      const earnRate = settings.pointsEarnPerBaht || 0;
      const pointsEarned = customerId && earnRate > 0 ? Math.floor(finalTotal * earnRate) : 0;

      let invoice;
      let invAttempts = 0;
      while (true) {
        const invoiceNo = await nextInvoiceNo(tx);
        try {
          invoice = await tx.posInvoice.create({ data: {
            invoiceNo, type, status: 'PAID',
            subtotalProduct, subtotalBooking, discount: combinedDiscount,
            vatMode: settings.vatMode, vatRate: settings.vatRate, vatAmount: vat.vatAmount, total: finalTotal,
            refundedAmount: 0,
            serviceCharge, totalCost,
            pointsEarned, pointsRedeemed, pointsRedeemValue,
            cashierId: session.user.id,
            shiftId: activeShift?.id || null,
            customerId, customerName, customerTaxId, customerAddress, customerPhone,
            bookingIds: bookingIds.length ? bookingIds : undefined,
            tabIds: allTabs.map((t) => t.id),
            itemsSnapshot: allItems.map((i) => ({ tabName: i.tabName, productId: i.productId, productName: i.productName, qty: i.qty, unitPrice: i.unitPrice, discount: i.discount })),
            note: (() => {
              const base = note?.toString().slice(0, 400) || '';
              if (!appliedCouponCode) return base || null;
              const tag = `[COUPON:${appliedCouponCode} -${couponDiscount.toFixed(2)}]`;
              return (base ? `${base} ${tag}` : tag).slice(0, 500);
            })(),
          }});
          break;
        } catch (e) {
          invAttempts++;
          if (invAttempts > 5) throw e;
        }
      }

      if (Array.isArray(splits) && splits.length > 0) {
        for (const sp of splits as SplitInput[]) {
          if (!['CASH', 'TRANSFER', 'QR', 'CARD', 'OTHER'].includes(sp.method)) throw new Error('PAYMENT_METHOD_INVALID');
          await tx.posInvoiceSplit.create({
            data: {
              invoiceId: invoice.id,
              label: String(sp.label).slice(0, 100),
              amount: Number(sp.amount),
              method: sp.method as 'CASH' | 'TRANSFER' | 'QR' | 'CARD' | 'OTHER',
              refNo: sp.refNo || null,
            },
          });
          await tx.posPayment.create({
            data: {
              invoiceId: invoice.id,
              method: sp.method as 'CASH' | 'TRANSFER' | 'QR' | 'CARD' | 'OTHER',
              amount: Number(sp.amount),
              refNo: sp.refNo || null,
            },
          });
        }
      } else {
        const p = payment as PaymentInput;
        const cashReceived = p.method === 'CASH' && p.cashReceived !== undefined ? Number(p.cashReceived) : null;
        const changeAmount = cashReceived !== null ? +(cashReceived - finalTotal).toFixed(2) : null;
        await tx.posPayment.create({
          data: {
            invoiceId: invoice.id,
            method: p.method as 'CASH' | 'TRANSFER' | 'QR' | 'CARD' | 'OTHER',
            amount: finalTotal,
            cashReceived,
            changeAmount,
            refNo: p.refNo || null,
          },
        });
      }

      if (customerId && pointsRedeemed > 0) {
        await redeemPoints(tx, customerId, pointsRedeemed, invoice.invoiceNo);
      }
      if (customerId && pointsEarned > 0) {
        await earnPoints(tx, customerId, pointsEarned, invoice.invoiceNo);
      }

      // Close tabs (atomic guard: only if still open/merged)
      const closed = await tx.posTab.updateMany({
        where: { id: { in: allTabs.map((t) => t.id) }, status: { in: ['OPEN', 'MERGED'] } },
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

      return invoice;
    });
    audit(session.user.id, 'POS_CHECKOUT', result.id, { invoiceNo: result.invoiceNo, total: result.total, shiftId: result.shiftId });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'checkout failed';
    if (msg === 'SHIFT_REQUIRED') return NextResponse.json({ error: 'ต้องเปิดกะก่อนขาย' }, { status: 409 });
    if (msg === 'DISCOUNT_INVALID') return NextResponse.json({ error: 'ส่วนลดไม่ถูกต้อง' }, { status: 400 });
    if (msg === 'POINTS_INSUFFICIENT') return NextResponse.json({ error: 'แต้มไม่พอ' }, { status: 400 });
    if (msg === 'POINTS_REDEEM_DISABLED') return NextResponse.json({ error: 'ระบบ redeem ปิดอยู่' }, { status: 400 });
    if (msg === 'SPLIT_MISMATCH') return NextResponse.json({ error: 'ผลรวม split ไม่เท่ากับยอดบิล' }, { status: 400 });
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
