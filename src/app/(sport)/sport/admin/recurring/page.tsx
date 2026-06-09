import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SPORT_TYPE_EMOJI } from '@/lib/booking';
import { RecurringGroupCard } from './recurring-client';

export const metadata = { title: 'จัดการการจองซ้ำ' };

export interface RecurringOccurrence {
  id: string;
  date: string;
  timeSlot: string;
  status: string;
}

export interface RecurringGroup {
  groupId: string;
  fieldId: string;
  fieldName: string;
  sportEmoji: string;
  openTime: string;
  closeTime: string;
  userName: string;
  userPhone: string | null;
  timeSlot: string;
  occurrences: RecurringOccurrence[];
}

export default async function AdminRecurringPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const rows = await prisma.booking.findMany({
    where: { recurringGroupId: { not: null } },
    orderBy: [{ recurringGroupId: 'asc' }, { date: 'asc' }],
    select: {
      id: true, date: true, timeSlot: true, status: true, recurringGroupId: true,
      user: { select: { name: true, phone: true } },
      field: { select: { id: true, name: true, sportType: true, openTime: true, closeTime: true } },
    },
  });

  const map = new Map<string, RecurringGroup>();
  for (const b of rows) {
    const gid = b.recurringGroupId!;
    let g = map.get(gid);
    if (!g) {
      g = {
        groupId: gid,
        fieldId: b.field.id,
        fieldName: b.field.name,
        sportEmoji: SPORT_TYPE_EMOJI[b.field.sportType] ?? '🏟️',
        openTime: b.field.openTime,
        closeTime: b.field.closeTime,
        userName: b.user.name ?? 'ลูกค้า',
        userPhone: b.user.phone,
        timeSlot: b.timeSlot,
        occurrences: [],
      };
      map.set(gid, g);
    }
    g.occurrences.push({
      id: b.id,
      date: b.date.toISOString(),
      timeSlot: b.timeSlot,
      status: b.status,
    });
  }

  // Newest groups first (by latest occurrence date).
  const groups = [...map.values()].sort((a, b) => {
    const al = a.occurrences[a.occurrences.length - 1]?.date ?? '';
    const bl = b.occurrences[b.occurrences.length - 1]?.date ?? '';
    return bl.localeCompare(al);
  });

  return (
    <div className="wrapper py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <a href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← แดชบอร์ด</a>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">จัดการการจองซ้ำ</h1>
        <span className="text-sm text-gray-400">{groups.length} กลุ่ม</span>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-12 text-center text-gray-400">
          ยังไม่มีการจองซ้ำ
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <RecurringGroupCard key={g.groupId} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
