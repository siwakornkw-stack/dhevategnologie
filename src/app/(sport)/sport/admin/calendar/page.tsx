import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SPORT_TYPE_EMOJI, STATUS_COLORS, STATUS_LABELS } from '@/lib/booking';
import { EditBookingButton } from '../bookings/edit-booking-button';
import Link from 'next/link';

export const metadata = { title: 'ปฏิทินการจอง' };

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'CASHIER')) redirect('/sport');

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
      field: { select: { id: true, name: true, sportType: true } },
    },
    orderBy: { date: 'asc' },
  });

  const fields = await prisma.field.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });

  const blockedDates = await prisma.fieldBlockedDate.findMany({
    where: { date: { gte: weekStart, lte: weekEnd } },
    orderBy: { date: 'asc' },
  });

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
    return bookings
      .filter((b) => isoDate(new Date(b.date)) === isoDate(day) && b.fieldId === fieldId)
      // Sort by start time. timeSlot is zero-padded "HH:MM-HH:MM", so a plain string
      // compare orders by start hour then minute.
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  }

  function blockedForDayAndField(day: Date, fieldId: string) {
    return blockedDates.filter(
      (bd) => isoDate(new Date(bd.date)) === isoDate(day) && bd.fieldId === fieldId,
    );
  }

  return (
    <div className="wrapper py-8 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">📅 ปฏิทินการจอง</h1>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-3">
          <Link href={`/sport/admin/calendar?date=${isoDate(prevWeek)}`}
            className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            ← สัปดาห์ก่อน
          </Link>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {weekStart.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })} –{' '}
            {weekEnd.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <Link href={`/sport/admin/calendar?date=${isoDate(nextWeek)}`}
            className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
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
                  <th key={isoDate(day)} className={`px-3 py-3 text-center ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                    <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                      {day.toLocaleDateString('th-TH', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-bold mt-0.5 tabular-nums ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
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
                  const dayBlocked = blockedForDayAndField(day, field.id);
                  const isToday = isoDate(day) === isoDate(today);
                  return (
                    <td key={isoDate(day)} className={`px-2 py-2 align-top min-w-[110px] ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                      {dayBookings.length === 0 && dayBlocked.length === 0 ? (
                        <span className="text-xs text-gray-300 dark:text-gray-700">-</span>
                      ) : (
                        <div className="space-y-1">
                          {dayBlocked.map((bd) => (
                            <div key={bd.id} className="px-2 py-1 rounded-lg text-xs bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                              <div className="font-semibold truncate tabular-nums">{bd.startTime && bd.endTime ? `${bd.startTime}-${bd.endTime}` : 'ทั้งวัน'}</div>
                              <div className="truncate">🚫 ปิดสนาม</div>
                              {bd.reason && <div className="text-xs italic opacity-80 break-words whitespace-pre-wrap mt-0.5">{bd.reason}</div>}
                            </div>
                          ))}
                          {dayBookings.map((b) => {
                            const chip = (
                              <>
                                <div className="font-semibold truncate tabular-nums">{b.timeSlot}</div>
                                <div className="truncate opacity-80">{b.user.name ?? '-'}</div>
                                <div className="text-xs opacity-60">{STATUS_LABELS[b.status]}</div>
                                {b.note && <div className="text-xs italic opacity-70 break-words whitespace-pre-wrap mt-0.5">หมายเหตุ: {b.note}</div>}
                              </>
                            );
                            const editable = b.status === 'PENDING' || b.status === 'APPROVED';
                            return editable ? (
                              <EditBookingButton
                                key={b.id}
                                bookingId={b.id}
                                initialDate={new Date(b.date).toISOString()}
                                initialTimeSlot={b.timeSlot}
                                fieldId={b.field.id}
                                fieldName={b.field.name}
                                customerName={b.user.name}
                                customerPhone={b.user.phone}
                                note={b.note}
                                triggerClassName={`block w-full text-left px-2 py-1 rounded-lg text-xs cursor-pointer transition hover:ring-2 hover:ring-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${STATUS_COLORS[b.status]}`}
                              >
                                {chip}
                              </EditBookingButton>
                            ) : (
                              <div key={b.id} className={`px-2 py-1 rounded-lg text-xs ${STATUS_COLORS[b.status]}`}>
                                {chip}
                              </div>
                            );
                          })}
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
