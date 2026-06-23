import { NextRequest, NextResponse } from 'next/server';
import type { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

const METHODS = ['CASH', 'TRANSFER', 'QR', 'QR_FIELD', 'CARD', 'OTHER'];

// Bills paid (partly or fully) with a given payment method, in a date range — backs the
// "ตามวิธีจ่าย" drill-down popup on the sales report. amount = portion paid via this method.
export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const methodStr = searchParams.get('method') || '';
  if (!METHODS.includes(methodStr)) return NextResponse.json({ error: 'method ไม่ถูกต้อง' }, { status: 400 });
  const method = methodStr as PaymentMethod;

  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
    return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
  }

  const invoices = await prisma.posInvoice.findMany({
    where: { status: 'PAID', paidAt: { gte: from, lte: to }, payments: { some: { method } } },
    select: {
      id: true, invoiceNo: true, paidAt: true, total: true, customerName: true,
      payments: { where: { method }, select: { amount: true } },
    },
    orderBy: { paidAt: 'desc' },
  });

  const rows = invoices.map((i) => ({
    invoiceId: i.id,
    invoiceNo: i.invoiceNo,
    paidAt: i.paidAt,
    total: i.total,
    customerName: i.customerName,
    amount: +i.payments.reduce((s, p) => s + p.amount, 0).toFixed(2),
  }));
  return NextResponse.json(rows);
}
