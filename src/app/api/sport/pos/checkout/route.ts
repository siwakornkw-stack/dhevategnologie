import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings, calcVat, nextInvoiceNo } from '@/lib/pos';
import { calculatePriceWithRules } from '@/lib/booking';

type SplitInput = { label: string; amount: number; method: string; refNo?: string };
type PaymentInput = { method: string; amount?: number; cashReceived?: number; refNo?: string };

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tabId, includeBooking, discount, payment, splits, note } = await req.json();
  if (!tabId) return NextResponse.json({ error: 'tabId required' }, { status: 400 });

  const settings = await getPosSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
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
      const itemsTotal = Math.max(subtotalProduct + subtotalBooking - discNum, 0);
      const vat = calcVat(itemsTotal, settings.vatMode, settings.vatRate);

      // Payment validation
      if (Array.isArray(splits) && splits.length > 0) {
        const sumSplit = (splits as SplitInput[]).reduce((s, x) => s + Number(x.amount), 0);
        if (Math.abs(sumSplit - vat.total) > 0.01) throw new Error('SPLIT_MISMATCH');
      } else {
        if (!payment) throw new Error('PAYMENT_REQUIRED');
        const p = payment as PaymentInput;
        if (!['CASH', 'TRANSFER', 'QR', 'CARD', 'OTHER'].includes(p.method)) throw new Error('PAYMENT_METHOD_INVALID');
        if (p.method === 'CASH' && p.cashReceived !== undefined && Number(p.cashReceived) < vat.total) {
          throw new Error('CASH_INSUFFICIENT');
        }
      }

      const type = subtotalBooking > 0 && subtotalProduct > 0 ? 'MIXED' : subtotalBooking > 0 ? 'BOOKING' : 'POS_TAB';

      let invoice;
      let invAttempts = 0;
      while (true) {
        const invoiceNo = await nextInvoiceNo();
        try {
          invoice = await tx.posInvoice.create({ data: {
            invoiceNo, type, status: 'PAID',
            subtotalProduct, subtotalBooking, discount: discNum,
            vatMode: settings.vatMode, vatRate: settings.vatRate, vatAmount: vat.vatAmount, total: vat.total,
            cashierId: session.user.id,
            bookingIds: bookingIds.length ? bookingIds : undefined,
            tabIds: allTabs.map((t) => t.id),
            itemsSnapshot: allItems.map((i) => ({ tabName: i.tabName, productId: i.productId, productName: i.productName, qty: i.qty, unitPrice: i.unitPrice, discount: i.discount })),
            note: note?.toString().slice(0, 500) || null,
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
        const changeAmount = cashReceived !== null ? +(cashReceived - vat.total).toFixed(2) : null;
        await tx.posPayment.create({
          data: {
            invoiceId: invoice.id,
            method: p.method as 'CASH' | 'TRANSFER' | 'QR' | 'CARD' | 'OTHER',
            amount: Number(p.amount) || vat.total,
            cashReceived,
            changeAmount,
            refNo: p.refNo || null,
          },
        });
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
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'checkout failed';
    if (msg === 'SPLIT_MISMATCH') return NextResponse.json({ error: 'ผลรวม split ไม่เท่ากับยอดบิล' }, { status: 400 });
    if (msg === 'CASH_INSUFFICIENT') return NextResponse.json({ error: 'เงินสดไม่พอ' }, { status: 400 });
    if (msg === 'TAB_NOT_OPEN') return NextResponse.json({ error: 'tab ปิดแล้ว' }, { status: 409 });
    if (msg === 'TAB_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบ tab' }, { status: 404 });
    if (msg === 'TAB_RACE') return NextResponse.json({ error: 'tab ถูกปิดโดยอีกหน้าจอ' }, { status: 409 });
    if (msg === 'BOOKING_RACE') return NextResponse.json({ error: 'booking ถูกจ่ายไปแล้ว' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
