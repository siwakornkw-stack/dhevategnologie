import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

type BookingSnap = { bookingId?: string; fieldId?: string; fieldName?: string; date?: string; timeSlot?: string; amount?: number };

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > 366 * 86_400_000) {
    return NextResponse.json({ error: 'ช่วงวันที่ต้องไม่เกิน 366 วัน' }, { status: 400 });
  }

  const invoices = await prisma.posInvoice.findMany({
    where: { type: 'BOOKING', paidAt: { gte: from, lte: to } },
    include: { payments: true },
  });

  const paid = invoices.filter((i) => i.status === 'PAID');
  const totalBooking = +paid.reduce((s, i) => s + i.total, 0).toFixed(2);
  const voidCount = invoices.filter((i) => i.status === 'VOID').length;

  const paidIds = paid.map((i) => i.id);
  const refunds = paidIds.length
    ? await prisma.posRefund.findMany({ where: { invoiceId: { in: paidIds } } })
    : [];
  const totalRefunds = +refunds.reduce((s, r) => s + r.amount, 0).toFixed(2);
  const netBooking = +(totalBooking - totalRefunds).toFixed(2);

  const byMethod: Record<string, number> = {};
  for (const inv of paid) {
    for (const p of inv.payments) byMethod[p.method] = +((byMethod[p.method] || 0) + p.amount).toFixed(2);
  }
  for (const r of refunds) byMethod[r.method] = +((byMethod[r.method] || 0) - r.amount).toFixed(2);

  const fieldAgg: Record<string, { fieldId: string; fieldName: string; count: number; amount: number }> = {};
  const dayAgg: Record<string, { count: number; amount: number }> = {};
  for (const inv of paid) {
    const snap = ((inv.itemsSnapshot as BookingSnap[] | null) || [])[0] || {};
    const fid = snap.fieldId || 'unknown';
    const fname = snap.fieldName || '(ไม่ระบุสนาม)';
    if (!fieldAgg[fid]) fieldAgg[fid] = { fieldId: fid, fieldName: fname, count: 0, amount: 0 };
    fieldAgg[fid].count += 1;
    fieldAgg[fid].amount = +(fieldAgg[fid].amount + inv.total).toFixed(2);

    const dk = dayKey(inv.paidAt);
    if (!dayAgg[dk]) dayAgg[dk] = { count: 0, amount: 0 };
    dayAgg[dk].count += 1;
    dayAgg[dk].amount = +(dayAgg[dk].amount + inv.total).toFixed(2);
  }

  const byField = Object.values(fieldAgg).sort((a, b) => b.amount - a.amount);
  const byDay = Object.entries(dayAgg)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    from,
    to,
    totals: { invoiceCount: paid.length, voidCount, totalBooking, totalRefunds, netBooking },
    byMethod,
    byField,
    byDay,
  });
}
