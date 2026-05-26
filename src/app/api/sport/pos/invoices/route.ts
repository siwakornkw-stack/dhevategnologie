import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

  const customerId = searchParams.get('customerId');
  const where: Record<string, unknown> = {};
  if (status === 'PAID' || status === 'VOID') where.status = status;
  if (customerId) where.customerId = customerId;
  const isCashier = session.user.role === 'CASHIER';
  const todayMin = new Date();
  todayMin.setHours(0, 0, 0, 0);
  const range: Record<string, Date> = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  if (isCashier) {
    if (!range.gte || range.gte < todayMin) range.gte = todayMin;
  }
  if (Object.keys(range).length) where.paidAt = range;

  const invoices = await prisma.posInvoice.findMany({
    where,
    include: { payments: true, splits: true },
    orderBy: { paidAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(invoices);
}
