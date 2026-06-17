import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'CASHIER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const status = searchParams.get('status');

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'Missing from/to' }, { status: 400 });
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const MAX_DAYS = 366;
  const diffDays = Math.floor((to.getTime() - from.getTime()) / 86400000);
  if (diffDays < 0 || diffDays > MAX_DAYS) {
    return NextResponse.json({ error: 'Date range out of bounds' }, { status: 400 });
  }

  const statusWhere =
    status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)
      ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' }
      : {};

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: from, lte: to },
      ...statusWhere,
    },
    orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
    include: {
      user: { select: { name: true, email: true, phone: true } },
      field: { select: { id: true, name: true, sportType: true } },
    },
    take: 5000,
  });

  return NextResponse.json({ bookings });
}
