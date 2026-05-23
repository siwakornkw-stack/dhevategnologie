import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings, calcVat, nextInvoiceNo } from '@/lib/pos';

type Item = { productId: string; qty: number; unitPrice?: number; discount?: number };

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { items, payment, discount, note } = await req.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items required' }, { status: 400 });
  }
  if (!payment || !['CASH', 'TRANSFER', 'QR', 'CARD', 'OTHER'].includes(payment.method)) {
    return NextResponse.json({ error: 'payment.method invalid' }, { status: 400 });
  }

  const settings = await getPosSettings();
  const allowNegative = settings.allowNegativeStock;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ids = (items as Item[]).map((i) => i.productId);
      const products = await tx.posProduct.findMany({ where: { id: { in: ids } } });
      const map = new Map(products.map((p) => [p.id, p]));

      let itemsTotal = 0;
      const snapshot: Array<{ productId: string; productName: string; qty: number; unitPrice: number; discount: number }> = [];
      const pendingMovements: Array<{ productId: string; qty: number }> = [];
      for (const it of items as Item[]) {
        const p = map.get(it.productId);
        if (!p) throw new Error('PRODUCT_NOT_FOUND');
        if (!p.isActive) throw new Error('PRODUCT_INACTIVE');
        const q = Number(it.qty);
        if (!Number.isInteger(q) || q <= 0) throw new Error('QTY_INVALID');
        const unitPrice = it.unitPrice !== undefined ? Number(it.unitPrice) : p.price;
        const lineDiscount = Number(it.discount) || 0;
        const line = unitPrice * q - lineDiscount;
        itemsTotal += line;
        snapshot.push({ productId: p.id, productName: p.name, qty: q, unitPrice, discount: lineDiscount });

        if (allowNegative) {
          await tx.posProduct.update({ where: { id: p.id }, data: { stockQty: { decrement: q } } });
        } else {
          const r = await tx.posProduct.updateMany({
            where: { id: p.id, stockQty: { gte: q } },
            data: { stockQty: { decrement: q } },
          });
          if (r.count === 0) throw new Error(`STOCK_INSUFFICIENT:${p.name}`);
        }
        pendingMovements.push({ productId: p.id, qty: q });
      }

      const discNum = Number(discount) || 0;
      const baseTotal = Math.max(itemsTotal - discNum, 0);
      const vat = calcVat(baseTotal, settings.vatMode, settings.vatRate);

      let invoice;
      let attempts = 0;
      while (true) {
        const invoiceNo = await nextInvoiceNo();
        try {
          invoice = await tx.posInvoice.create({
            data: {
              invoiceNo,
              type: 'POS_QUICK',
              status: 'PAID',
              subtotalProduct: itemsTotal,
              subtotalBooking: 0,
              discount: discNum,
              vatMode: settings.vatMode,
              vatRate: settings.vatRate,
              vatAmount: vat.vatAmount,
              total: vat.total,
              cashierId: session.user.id,
              itemsSnapshot: snapshot as unknown as object,
              note: note?.toString().slice(0, 500) || null,
            },
          });
          break;
        } catch (e) {
          attempts++;
          if (attempts > 5) throw e;
        }
      }
      const amount = Number(payment.amount) || vat.total;
      const cashReceived = payment.method === 'CASH' && payment.cashReceived !== undefined ? Number(payment.cashReceived) : null;
      const changeAmount = cashReceived !== null ? +(cashReceived - vat.total).toFixed(2) : null;
      if (payment.method === 'CASH' && cashReceived !== null && cashReceived < vat.total) {
        throw new Error('CASH_INSUFFICIENT');
      }
      await tx.posPayment.create({
        data: {
          invoiceId: invoice.id,
          method: payment.method,
          amount,
          cashReceived,
          changeAmount,
          refNo: payment.refNo || null,
        },
      });

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
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'quick-sale failed';
    if (msg.startsWith('STOCK_INSUFFICIENT')) return NextResponse.json({ error: `สต็อกไม่พอ: ${msg.split(':')[1]}` }, { status: 409 });
    if (msg === 'CASH_INSUFFICIENT') return NextResponse.json({ error: 'เงินสดไม่พอ' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
