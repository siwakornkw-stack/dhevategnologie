import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { expandTimeSlot, formatDateISO } from '@/lib/booking';
import { AvailabilityClient } from './availability-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'ดูสนามว่าง - Admin' };
}

export default async function AdminAvailabilityPage() {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'CASHIER')) redirect('/sport');

  const today = formatDateISO(new Date());
  const todayObj = new Date(today);

  const fieldsRaw = await prisma.field.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { priceRules: { orderBy: { startTime: 'asc' } } },
  });

  const fieldIds = fieldsRaw.map((f) => f.id);
  const [bookings, blockedDates] = await Promise.all([
    prisma.booking.findMany({
      where: { fieldId: { in: fieldIds }, date: todayObj, status: { in: ['PENDING', 'APPROVED'] } },
      select: { fieldId: true, timeSlot: true, status: true },
    }),
    prisma.fieldBlockedDate.findMany({
      where: { fieldId: { in: fieldIds }, date: todayObj },
      select: { fieldId: true },
    }),
  ]);

  const blockedSet = new Set(blockedDates.map((b) => b.fieldId));
  const initialAvailability: Record<string, Record<string, string>> = {};
  const initialPriceRules: Record<string, { startTime: string; endTime: string; pricePerHour: number; label: string | null }[]> = {};
  for (const f of fieldsRaw) {
    initialAvailability[f.id] = {};
    initialPriceRules[f.id] = f.priceRules.map((r) => ({
      startTime: r.startTime, endTime: r.endTime, pricePerHour: r.pricePerHour, label: r.label,
    }));
  }
  if (blockedSet.size < fieldIds.length) {
    for (const b of bookings) {
      if (blockedSet.has(b.fieldId)) continue;
      for (const slot of expandTimeSlot(b.timeSlot)) {
        initialAvailability[b.fieldId][slot] = b.status;
      }
    }
  }

  const initialFields = fieldsRaw.map((f) => ({
    id: f.id, name: f.name, sportType: f.sportType,
    pricePerHour: f.pricePerHour, openTime: f.openTime, closeTime: f.closeTime,
  }));

  return (
    <div className="wrapper py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link
          href="/sport/admin"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
        >
          &larr; Dashboard
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">ดูสนามว่าง</h1>
      </div>
      <AvailabilityClient
        initialDate={today}
        initialFields={initialFields}
        initialAvailability={initialAvailability}
        initialPriceRules={initialPriceRules}
      />
    </div>
  );
}
