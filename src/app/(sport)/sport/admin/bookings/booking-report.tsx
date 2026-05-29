'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { formatDateISO } from '@/lib/booking';
import { cn } from '@/lib/utils';
import { EditBookingButton } from './edit-booking-button';

interface ReportBooking {
  id: string;
  date: string;
  timeSlot: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  note: string | null;
  createdAt: string;
  user: { name: string | null; email: string; phone: string | null };
  field: { name: string; sportType: string };
}

const STATUS_LABEL: Record<string, string> = {
  ALL: 'ทั้งหมด',
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติ',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0);
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function BookingReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState(formatDateISO(firstDayOfMonth(year, month)));
  const [toDate, setToDate] = useState(formatDateISO(lastDayOfMonth(year, month)));
  const [bookings, setBookings] = useState<ReportBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setFromDate(formatDateISO(firstDayOfMonth(year, month)));
    setToDate(formatDateISO(lastDayOfMonth(year, month)));
  }, [year, month]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ from: fromDate, to: toDate });
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        const res = await fetch(`/api/sport/admin/bookings/report?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'load failed');
        if (!cancelled) setBookings(data.bookings ?? []);
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, statusFilter, refreshKey]);

  const byDay = useMemo(() => {
    const map: Record<string, ReportBooking[]> = {};
    for (const b of bookings) {
      const key = formatDateISO(new Date(b.date));
      (map[key] ??= []).push(b);
    }
    return map;
  }, [bookings]);

  const calendarCells = useMemo(() => {
    const first = firstDayOfMonth(year, month);
    const last = lastDayOfMonth(year, month);
    const startWeekday = first.getDay();
    const cells: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= last.getDate(); d++) {
      const dt = new Date(year, month, d);
      cells.push({ date: dt, iso: formatDateISO(dt) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
    return cells;
  }, [year, month]);

  function changeMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(null);
  }

  function downloadCSV() {
    if (bookings.length === 0) {
      toast.warning('ไม่มีข้อมูลให้ดาวน์โหลด');
      return;
    }
    const headers = ['date', 'timeSlot', 'field', 'sportType', 'status', 'customerName', 'email', 'phone', 'note', 'createdAt'];
    const rows = bookings.map((b) => [
      formatDateISO(new Date(b.date)),
      b.timeSlot,
      b.field.name,
      b.field.sportType,
      b.status,
      b.user.name ?? '',
      b.user.email,
      b.user.phone ?? '',
      b.note ?? '',
      new Date(b.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings_${fromDate}_${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
  const weekdayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const today = formatDateISO(new Date());
  const selectedList = selectedDay ? byDay[selectedDay] ?? [] : [];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">รายงานการจอง</span>
        <button
          onClick={downloadCSV}
          disabled={loading || bookings.length === 0}
          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ดาวน์โหลด CSV ({bookings.length})
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => changeMonth(-1)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              ‹
            </button>
            <span className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[140px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">จาก</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs"
            />
            <label className="text-xs text-gray-500">ถึง</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs"
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {loading && <span className="text-xs text-gray-400 animate-pulse">โหลด...</span>}
        </div>

        {/* Calendar */}
        <div>
          <div className="grid grid-cols-7 gap-1 text-xs text-center text-gray-400 mb-1">
            {weekdayLabels.map((w) => (
              <div key={w} className="py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell.date || !cell.iso) {
                return <div key={i} className="aspect-square" />;
              }
              const list = byDay[cell.iso] ?? [];
              const count = list.length;
              const isToday = cell.iso === today;
              const isSelected = cell.iso === selectedDay;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : cell.iso)}
                  className={cn(
                    'aspect-square rounded-lg border text-left p-1 sm:p-1.5 flex flex-col transition relative',
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : count > 0
                      ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-300'
                      : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800',
                    isToday && 'ring-1 ring-primary-400'
                  )}
                >
                  <span className={cn('text-xs font-medium', isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300')}>
                    {cell.date.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="mt-auto inline-flex items-center gap-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-600 text-white">
                        {count}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day list */}
        {selectedDay && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>
                {new Date(selectedDay).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                {' · '}
                {selectedList.length} รายการ
              </span>
              <button onClick={() => setSelectedDay(null)} className="text-xs text-gray-400 hover:text-gray-600">ปิด</button>
            </div>
            {selectedList.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">ไม่มีการจอง</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {selectedList.map((b) => (
                  <div key={b.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-primary-600 dark:text-primary-400 min-w-[100px]">{b.timeSlot}</span>
                    <span className="text-gray-800 dark:text-gray-200">{b.field.name}</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-600 dark:text-gray-400">{b.user.name ?? b.user.email}</span>
                    {b.user.phone && <span className="text-gray-400">{b.user.phone}</span>}
                    <span className={cn('ml-auto px-2 py-0.5 rounded-full font-semibold', STATUS_COLOR[b.status])}>
                      {STATUS_LABEL[b.status]}
                    </span>
                    {(b.status === 'PENDING' || b.status === 'APPROVED') && (
                      <EditBookingButton
                        bookingId={b.id}
                        initialDate={b.date}
                        initialTimeSlot={b.timeSlot}
                        fieldName={b.field.name}
                        customerName={b.user.name}
                        customerPhone={b.user.phone}
                        note={b.note}
                        onSaved={() => setRefreshKey((k) => k + 1)}
                        triggerClassName="px-2 py-0.5 rounded-lg font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
                      >
                        ✎ แก้
                      </EditBookingButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
