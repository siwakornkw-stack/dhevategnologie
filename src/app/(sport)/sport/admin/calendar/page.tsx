import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SPORT_TYPE_EMOJI, STATUS_COLORS, STATUS_LABELS } from '@/lib/booking';
import Link from 'next/link';

export const metadata = { title: 'ปฏิทินการจอง' };

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const { date: dateStr } = await searchParams;

  // Default: current week (Monday)
  const today = new Date();
  const weekStart = dateStr ? new Date(dateStr) : (() => {
    const d = new Date(today);
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: { date: { gte: weekStart, lte: weekEnd } },
    include: {
      user: { select: { name: true, phone: true } },
      field: { select: { name: true, sportType: true } },
    },
    orderBy: { date: 'asc' },
  });

  const fields = await prisma.field.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(weekStart.getDate() - 7);

  const nextWeek = new Date(weekStart);
  nextWeek.setDate(weekStart.getDate() + 7);

  function isoDate(d: Date) { return d.toISOString().split('T')[0]; }

  function bookingsForDayAndField(day: Date, fieldId: string) {
    return bookings.filter(
      (b) => isoDate(new Date(b.date)) === isoDate(day) && b.fieldId === fieldId,
    );
  }

  return (
    <div className="wrapper py-8 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📅 ปฏิทินการจอง</h1>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-3">
          <Link href={`/sport/admin/calendar?date=${isoDate(prevWeek)}`}
            className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            ← สัปดาห์ก่อน
          </Link>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {weekStart.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })} –{' '}
            {weekEnd.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <Link href={`/sport/admin/calendar?date=${isoDate(nextWeek)}`}
            className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            สัปดาห์ถัดไป →
          </Link>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">สนาม</th>
              {days.map((day) => {
                const isToday = isoDate(day) === isoDate(today);
                return (
                  <th key={isoDate(day)} className={`px-3 py-3 text-center ${isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                    <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                      {day.toLocaleDateString('th-TH', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-bold mt-0.5 ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {day.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {fields.map((field) => (
              <tr key={field.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{SPORT_TYPE_EMOJI[field.sportType]}</span>
                    <span className="text-xs leading-tight">{field.name}</span>
                  </div>
                </td>
                {days.map((day) => {
                  const dayBookings = bookingsForDayAndField(day, field.id);
                  const isToday = isoDate(day) === isoDate(today);
                  return (
                    <td key={isoDate(day)} className={`px-2 py-2 align-top min-w-[110px] ${isToday ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                      {dayBookings.length === 0 ? (
                        <span className="text-xs text-gray-300 dark:text-gray-700">-</span>
                      ) : (
                        <div className="space-y-1">
                          {dayBookings.map((b) => (
                            <div key={b.id} className={`px-2 py-1 rounded-lg text-xs ${STATUS_COLORS[b.status]}`}>
                              <div className="font-semibold truncate">{b.timeSlot}</div>
                              <div className="truncate opacity-80">{b.user.name ?? '-'}</div>
                              <div className="text-xs opacity-60">{STATUS_LABELS[b.status]}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
