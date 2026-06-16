import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const unpaidOnly = searchParams.get('unpaid') !== '0';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = new Date(today);
  past.setDate(past.getDate() - 7);

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: past },
      ...(unpaidOnly ? { paidAt: null } : {}),
      status: { in: ['PENDING', 'APPROVED'] },
      ...(q
        ? {
            OR: [
              { user: { name: { contains: q, mode: 'insensitive' } } },
              { user: { phone: { contains: q } } },
              { field: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { name: true, phone: true } },
      field: { select: { name: true } },
    },
    orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
    take: 200,
  });
  // Order the booking picker: today + upcoming first (ascending), past after.
  const todayMs = today.getTime();
  bookings.sort((a, b) => {
    const aPast = a.date.getTime() < todayMs ? 1 : 0;
    const bPast = b.date.getTime() < todayMs ? 1 : 0;
    if (aPast !== bPast) return aPast - bPast;
    const d = a.date.getTime() - b.date.getTime();
    return d !== 0 ? d : a.timeSlot.localeCompare(b.timeSlot);
  });
  return NextResponse.json(bookings);
}
