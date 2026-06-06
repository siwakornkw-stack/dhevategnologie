import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

const POS_ACTIONS = [
  'POS_CHECKOUT',
  'POS_QUICK_SALE',
  'POS_INVOICE_VOID',
  'POS_REFUND',
  'POS_SHIFT_OPEN',
  'POS_SHIFT_CLOSE',
  'POS_PRODUCT_CREATE',
  'POS_PRODUCT_UPDATE',
  'POS_PRODUCT_DELETE',
  'POS_STOCK_IN',
  'POS_STOCK_OUT',
  'POS_STOCK_ADJUST',
  'POS_STOCK_BULK_ADJUST',
  'POS_SETTINGS_UPDATE',
  'POS_CASH_MOVEMENT',
  'POS_CUSTOMER_CREATE',
  'POS_REPORT_CSV_EXPORT',
  'POS_BOOKING_REPORT_CSV_EXPORT',
  'POS_TAB_HOLD',
  'POS_TAB_RESUME',
  'POS_CASHIER_CREATE',
  'POS_CASHIER_DELETE',
];

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const adminId = searchParams.get('adminId');
  const targetId = searchParams.get('targetId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  else where.action = { in: POS_ACTIONS };
  if (adminId) where.adminId = adminId;
  if (targetId) where.targetId = targetId;
  const range: Record<string, Date> = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
    range.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid to date' }, { status: 400 });
    range.lte = d;
  }
  if (Object.keys(range).length) where.createdAt = range;

  const logs = await prisma.auditLog.findMany({
    where,
    include: { admin: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(logs);
}
