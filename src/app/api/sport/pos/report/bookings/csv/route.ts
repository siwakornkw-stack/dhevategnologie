import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, audit } from '@/lib/pos';

type BookingSnap = { bookingId?: string; fieldId?: string; fieldName?: string; date?: string; timeSlot?: string; amount?: number };

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
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return new Response('ช่วงวันที่ไม่ถูกต้อง', { status: 400 });
  if (to < from) return new Response('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', { status: 400 });
  if (to.getTime() - from.getTime() > 366 * 86_400_000) return new Response('ช่วงวันที่ต้องไม่เกิน 366 วัน', { status: 400 });

  const invoices = await prisma.posInvoice.findMany({
    where: { type: 'BOOKING', paidAt: { gte: from, lte: to } },
    orderBy: { paidAt: 'asc' },
    include: { payments: true, relatedInvoice: { select: { invoiceNo: true } } },
  });

  const headers = [
    'invoiceNo', 'paidAt', 'status', 'fieldName', 'bookingDate', 'timeSlot',
    'amount', 'refundedAmount', 'sourceInvoiceNo', 'paymentMethods', 'cashierId',
  ];

  const rows = invoices.map((i) => {
    const snap = ((i.itemsSnapshot as BookingSnap[] | null) || [])[0] || {};
    const methods = i.payments.map((p) => `${p.method}:${p.amount.toFixed(2)}`).join('|');
    return [
      i.invoiceNo, fmtDate(i.paidAt), i.status,
      snap.fieldName || '', snap.date ? snap.date.slice(0, 10) : '', snap.timeSlot || '',
      i.total.toFixed(2), (i.refundedAmount || 0).toFixed(2),
      i.relatedInvoice?.invoiceNo || '', methods, i.cashierId || '',
    ];
  });

  const lines = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  const body = '\uFEFF' + lines.join('\r\n');

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  audit(session.user.id, 'POS_BOOKING_REPORT_CSV_EXPORT', null, { from: fromStr, to: toStr, count: invoices.length });
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pos-booking-report-${fromStr}_${toStr}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
