import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const raw = String(v);
  const s = /^[=+\-@\t\r]/.test(raw) ? '\t' + raw : raw;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return new Response('Forbidden', { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();

  const invoices = await prisma.posInvoice.findMany({
    where: { paidAt: { gte: from, lte: to } },
    orderBy: { paidAt: 'asc' },
    include: { payments: true },
  });

  const headers = [
    'invoiceNo', 'paidAt', 'status', 'type',
    'customerName', 'customerTaxId', 'customerAddress', 'customerPhone',
    'subtotalProduct', 'subtotalBooking', 'discount',
    'vatMode', 'vatRate', 'vatAmount', 'serviceCharge', 'total',
    'refundedAmount', 'pointsEarned', 'pointsRedeemed', 'pointsRedeemValue',
    'paymentMethods', 'cashierId',
  ];

  const rows = invoices.map((i) => {
    const methods = i.payments.map((p) => `${p.method}:${p.amount.toFixed(2)}`).join('|');
    return [
      i.invoiceNo, fmtDate(i.paidAt), i.status, i.type,
      i.customerName || '', i.customerTaxId || '', i.customerAddress || '', i.customerPhone || '',
      i.subtotalProduct.toFixed(2), i.subtotalBooking.toFixed(2), i.discount.toFixed(2),
      i.vatMode, i.vatRate.toFixed(2), i.vatAmount.toFixed(2), (i.serviceCharge || 0).toFixed(2), i.total.toFixed(2),
      (i.refundedAmount || 0).toFixed(2), i.pointsEarned, i.pointsRedeemed, (i.pointsRedeemValue || 0).toFixed(2),
      methods, i.cashierId || '',
    ];
  });

  const lines = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  const body = '\uFEFF' + lines.join('\r\n');

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pos-report-${fromStr}_${toStr}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
