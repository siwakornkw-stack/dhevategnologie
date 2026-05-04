'use client';

import { useState } from 'react';
import { SPORT_TYPE_EMOJI } from '@/lib/booking';
import { BookingStatusBadge } from '@/components/sport/booking-status-badge';

interface Booking {
  id: string;
  date: string;
  timeSlot: string;
  status: string;
  field: { name: string; sportType: string };
}

const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-yellow-400',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-400',
  CANCELLED: 'bg-gray-400',
};

export function BookingCalendar({ bookings }: { bookings: Booking[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Map bookings by date string YYYY-MM-DD
  const byDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    const d = new Date(b.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(b);
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedKey = selected;
  const selectedBookings = selectedKey ? (byDate.get(selectedKey) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-lg">
          &lt;
        </button>
        <span className="text-base font-semibold text-gray-800 dark:text-white">
          {MONTHS_TH[month]} {year + 543}
        </span>
        <button onClick={nextMonth} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-lg">
          &gt;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {DAYS_TH.map((d) => (
          <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayBookings = byDate.get(key) ?? [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isSelected = selectedKey === key;

          return (
            <button
              key={idx}
              onClick={() => setSelected(isSelected ? null : key)}
              className={`relative flex flex-col items-center pt-1.5 pb-1 rounded-xl transition min-h-[44px]
                ${isSelected ? 'bg-primary-500 text-white' : isToday ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
              `}
            >
              <span className={`text-sm font-medium leading-none ${isToday && !isSelected ? 'text-primary-600 dark:text-primary-400' : isSelected ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                {day}
              </span>
              {dayBookings.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[32px]">
                  {dayBookings.slice(0, 3).map((b, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : STATUS_DOT[b.status] ?? 'bg-gray-400'}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day bookings */}
      {selectedKey && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {selectedBookings.length === 0
              ? 'ไม่มีการจองในวันนี้'
              : `การจองวันที่ ${parseInt(selectedKey.split('-')[2])} (${selectedBookings.length} รายการ)`}
          </p>
          {selectedBookings.map((b) => (
            <div key={b.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
              <span className="text-xl">{SPORT_TYPE_EMOJI[b.field.sportType] ?? '🏟️'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{b.field.name}</p>
                <p className="text-xs text-gray-400">{b.timeSlot} น.</p>
              </div>
              <BookingStatusBadge status={b.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
