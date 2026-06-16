import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';
import { TabsClient } from './tabs-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tabs - POS' };

export default async function PosTabsPage() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) redirect('/sport');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = new Date(today);
  past.setDate(past.getDate() - 7);

  const [tabs, bookings] = await Promise.all([
    prisma.posTab.findMany({
      where: { OR: [{ status: 'OPEN' }, { status: 'MERGED' }] },
      select: {
        id: true, name: true, teamLabel: true, bookingId: true, status: true,
        parentTabId: true, openedAt: true,
        items: {
          where: { status: 'ACTIVE' },
          select: { id: true, qty: true, unitPrice: true, discount: true },
        },
      },
      orderBy: { openedAt: 'desc' },
    }),
    prisma.booking.findMany({
      where: { date: { gte: past }, paidAt: null, status: { in: ['PENDING', 'APPROVED'] } },
      include: {
        user: { select: { name: true, phone: true } },
        field: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
      take: 200,
    }),
  ]);

  // Order the booking picker: today + upcoming first (ascending), past after.
  const todayMs = today.getTime();
  bookings.sort((a, b) => {
    const aPast = a.date.getTime() < todayMs ? 1 : 0;
    const bPast = b.date.getTime() < todayMs ? 1 : 0;
    if (aPast !== bPast) return aPast - bPast;
    const d = a.date.getTime() - b.date.getTime();
    return d !== 0 ? d : a.timeSlot.localeCompare(b.timeSlot);
  });

  const initialTabs = tabs.map((t) => ({
    ...t,
    openedAt: t.openedAt.toISOString(),
  }));
  const initialBookings = bookings.map((b) => ({
    id: b.id,
    date: b.date.toISOString(),
    timeSlot: b.timeSlot,
    note: b.note,
    user: b.user,
    field: b.field,
  }));

  return <TabsClient initialTabs={initialTabs} initialBookings={initialBookings} />;
}
