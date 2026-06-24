import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';
import { BUSINESS_DAY_CUTOFF_HOUR } from '@/lib/business-day';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

  const customerId = searchParams.get('customerId');
  const type = searchParams.get('type');
  const where: Record<string, unknown> = {};
  if (status === 'PAID' || status === 'VOID') where.status = status;
  if (customerId) where.customerId = customerId;
  if (type === 'POS') where.type = { in: ['POS_QUICK', 'POS_TAB', 'MIXED'] };
  else if (type && ['POS_QUICK', 'POS_TAB', 'BOOKING', 'MIXED'].includes(type)) where.type = type;
  const isCashier = session.user.role === 'CASHIER';
  const range: Record<string, Date> = {};
  if (from) {
    const f = new Date(from);
    if (isNaN(f.getTime())) return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
    range.gte = f;
  }
  if (to) {
    const t = new Date(to);
    if (isNaN(t.getTime())) return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
    range.lte = t;
  }
  if (isCashier) {
    // Floor to the start of the CURRENT Asia/Bangkok business day. The shop runs overnight, so
    // a sale before 07:00 Bangkok belongs to the previous business day. Server runs UTC on
    // Vercel, so the old server-local setHours(0,0,0,0) was 07:00 Bangkok and hid a night-shift
    // cashier's own 00:00–06:59 invoices from their history (no reprint/refund/void).
    const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
    const CUTOFF_MS = BUSINESS_DAY_CUTOFF_HOUR * 60 * 60 * 1000;
    const bkkNow = Date.now() + BANGKOK_OFFSET_MS;
    const businessDayStartBkk = Math.floor((bkkNow - CUTOFF_MS) / 86_400_000) * 86_400_000 + CUTOFF_MS;
    const todayMin = new Date(businessDayStartBkk - BANGKOK_OFFSET_MS);
    if (!range.gte || range.gte < todayMin) range.gte = todayMin;
    // Scope to own cashier's invoices to prevent cross-cashier visibility
    where.cashierId = session.user.id;
  }
  if (Object.keys(range).length) where.paidAt = range;

  const invoices = await prisma.posInvoice.findMany({
    where,
    include: {
      payments: true,
      splits: true,
      relatedInvoice: { select: { id: true, invoiceNo: true } },
    },
    orderBy: { paidAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(invoices);
}
