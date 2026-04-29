import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Waiting List - Admin' };

export default async function AdminWaitingListPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const entries = await prisma.waitingList.findMany({
    orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { name: true, email: true } },
      field: { select: { name: true } },
    },
  });

  type Entry = (typeof entries)[0];

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const key = `${e.fieldId}__${e.date.toISOString().slice(0, 10)}__${e.timeSlot}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const slots = Object.values(grouped);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Waiting List</h1>

      {slots.length === 0 ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          ไม่มีรายการใน Waiting List
        </div>
      ) : (
        <div className="space-y-6">
          {slots.map((group) => {
            const first = group[0];
            return (
              <div
                key={`${first.fieldId}-${first.date}-${first.timeSlot}`}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-theme-sm overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {first.field.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {first.date.toLocaleDateString('th-TH')}
                  </span>
                  <span className="text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                    {first.timeSlot} น.
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {group.length} คนรออยู่
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {group.map((entry, i) => (
                    <div key={entry.id} className="px-6 py-3 flex items-center gap-4">
                      <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold flex items-center justify-center text-gray-600 dark:text-gray-400">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {entry.user.name ?? '-'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {entry.user.email}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        เข้าคิว {new Date(entry.createdAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
