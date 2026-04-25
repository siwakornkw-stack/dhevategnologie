'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDateISO } from '@/lib/booking';

const DAYS_TH = ['อา', 'จ.', 'อ.', 'พ.', 'พฤ', 'ศ.', 'ส.'];
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

interface DatePickerProps {
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function DatePicker({ selectedDate, onSelect }: DatePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = formatDateISO(today);

  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const canGoPrev = viewMonth > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = viewMonth < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  function prevMonth() {
    if (canGoPrev) setViewMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    if (canGoNext) setViewMonth(new Date(year, month + 1, 1));
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition text-base"
          aria-label="เดือนก่อน"
        >
          ←
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {MONTHS_TH[month]} {year + 543}
        </span>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition text-base"
          aria-label="เดือนถัดไป"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS_TH.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}

        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const date = new Date(year, month, day);
          const iso = formatDateISO(date);
          const isPast = date < today;
          const isFuture = date > maxDate;
          const isDisabled = isPast || isFuture;
          const isSelected = iso === selectedDate;
          const isToday = iso === todayISO;

          return (
            <button
              key={iso}
              onClick={() => !isDisabled && onSelect(iso)}
              disabled={isDisabled}
              className={cn(
                'relative flex items-center justify-center rounded-lg text-sm h-9 transition-all',
                isDisabled
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  : isSelected
                    ? 'bg-primary-600 text-white font-semibold shadow-md scale-105'
                    : isToday
                      ? 'font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20',
              )}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
