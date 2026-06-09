'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { RecurringGroup } from './page';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติ',
  CANCELLED: 'ยกเลิก',
  REJECTED: 'ปฏิเสธ',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'text-amber-600 dark:text-amber-400',
  APPROVED: 'text-emerald-600 dark:text-emerald-400',
  CANCELLED: 'text-gray-400 line-through',
  REJECTED: 'text-rose-500 line-through',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isActive(status: string): boolean {
  return status === 'PENDING' || status === 'APPROVED';
}

export function RecurringGroupCard({ group }: { group: RecurringGroup }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newTime, setNewTime] = useState(group.timeSlot);
  const [addDate, setAddDate] = useState('');

  const active = group.occurrences.filter((o) => isActive(o.status));
  const firstDate = group.occurrences[0]?.date;
  const lastDate = group.occurrences[group.occurrences.length - 1]?.date;

  async function run(fn: () => Promise<Response>, okMsg: (data: unknown) => string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || 'ทำรายการไม่สำเร็จ');
        return;
      }
      toast.success(okMsg(data));
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  }

  function cancelSeries(scope: 'future' | 'all') {
    const label = scope === 'future' ? 'รายการในอนาคต' : 'ทั้งหมด';
    if (!confirm(`ยกเลิก${label}ของกลุ่มนี้? (คืนแต้ม/refund ตามเงื่อนไข)`)) return;
    run(
      () => fetch(`/api/sport/bookings/recurring/${group.groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', scope }),
      }),
      (d) => `ยกเลิก ${(d as { cancelled: number }).cancelled} รายการ`,
    );
  }

  function rescheduleSeries() {
    if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(newTime)) {
      toast.error('รูปแบบเวลาไม่ถูกต้อง (เช่น 18:00-19:00)');
      return;
    }
    if (!confirm(`เปลี่ยนเวลาทุกรายการในอนาคตเป็น ${newTime}?`)) return;
    run(
      () => fetch(`/api/sport/bookings/recurring/${group.groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', scope: 'future', timeSlot: newTime }),
      }),
      (d) => {
        const r = d as { updated: number; conflicts: string[] };
        return r.conflicts.length > 0
          ? `เปลี่ยน ${r.updated} รายการ, ชน ${r.conflicts.length} (${r.conflicts.join(', ')})`
          : `เปลี่ยนเวลา ${r.updated} รายการ`;
      },
    );
  }

  function addOccurrence() {
    if (!addDate) { toast.error('เลือกวันที่ก่อน'); return; }
    run(
      () => fetch(`/api/sport/bookings/recurring/${group.groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: addDate }),
      }),
      () => 'เพิ่มการจองแล้ว',
    ).then(() => setAddDate(''));
  }

  function cancelOne(id: string) {
    if (!confirm('ยกเลิกรายการนี้?')) return;
    run(
      () => fetch(`/api/sport/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      }),
      () => 'ยกเลิกรายการแล้ว',
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 sm:px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
      >
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl flex-shrink-0">
          {group.sportEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {group.fieldName} · <span className="tabular-nums">{group.timeSlot} น.</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {group.userName}{group.userPhone ? ` · ${group.userPhone}` : ''}
          </p>
          {firstDate && lastDate && (
            <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
              {fmtDate(firstDate)} – {fmtDate(lastDate)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
            {active.length} ครั้ง
          </span>
          <span className="text-xs text-gray-400">จาก {group.occurrences.length}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 sm:px-5 py-4 space-y-4">
          {/* Occurrences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {group.occurrences.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                <span className="tabular-nums text-gray-700 dark:text-gray-300">
                  {fmtDate(o.date)} · {o.timeSlot}
                </span>
                <div className="flex items-center gap-2">
                  <span className={STATUS_CLASS[o.status] ?? 'text-gray-500'}>{STATUS_LABEL[o.status] ?? o.status}</span>
                  {isActive(o.status) && (
                    <button
                      onClick={() => cancelOne(o.id)}
                      disabled={busy}
                      className="text-rose-500 hover:text-rose-600 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Series actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => cancelSeries('future')}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 transition"
            >
              ยกเลิกอนาคต
            </button>
            <button
              onClick={() => cancelSeries('all')}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 transition"
            >
              ยกเลิกทั้งหมด
            </button>
          </div>

          {/* Reschedule */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500">เปลี่ยนเวลา (อนาคต):</label>
            <input
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              placeholder="18:00-19:00"
              className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={rescheduleSeries}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 transition"
            >
              เปลี่ยนเวลา
            </button>
          </div>

          {/* Add occurrence */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500">เพิ่มครั้ง:</label>
            <input
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={addOccurrence}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition"
            >
              เพิ่ม
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
