'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function MiniCalendar({
  selectedDates,
  blockedDates,
  onToggle,
}: {
  selectedDates: string[];
  blockedDates: string[];
  onToggle: (iso: string) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blockedSet = new Set(blockedDates.map((d) => d.slice(0, 10)));
  const selectedSet = new Set(selectedDates);

  const monthName = new Date(year, month, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition text-sm">‹</button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{monthName}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition text-sm">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const iso = toISO(year, month, day);
          const isPast = iso < todayISO;
          const isBlocked = blockedSet.has(iso);
          const isSelected = selectedSet.has(iso);

          return (
            <button
              key={iso}
              onClick={() => !isPast && !isBlocked && onToggle(iso)}
              disabled={isPast || isBlocked}
              className={[
                'h-8 w-full rounded-lg text-xs font-medium transition-all',
                isPast ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' :
                isBlocked ? 'bg-red-100 dark:bg-red-900/30 text-red-400 cursor-not-allowed' :
                isSelected ? 'bg-primary-600 text-white shadow-sm' :
                'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary-600 inline-block" /> เลือก</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 inline-block" /> ปิดแล้ว</span>
      </div>
    </div>
  );
}

export function BlockedDatesManager({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sport/admin/fields/${fieldId}/blocked-dates`);
      const data = await res.json();
      if (res.ok) setDates(data);
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function toggleDate(iso: string) {
    setSelectedDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDates.length === 0) return toast.error('เลือกวันที่อย่างน้อย 1 วัน');
    setAdding(true);
    try {
      const results = await Promise.all(
        selectedDates.map((date) =>
          fetch(`/api/sport/admin/fields/${fieldId}/blocked-dates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, reason: reason.trim() || null }),
          }).then((r) => r.json().then((d) => ({ ok: r.ok, date, error: d.error })))
        )
      );
      const failed = results.filter((r) => !r.ok);
      const succeeded = results.filter((r) => r.ok).length;
      if (succeeded > 0) {
        toast.success(`บล็อก ${succeeded} วันแล้ว`);
        setSelectedDates([]);
        setReason('');
        load();
        router.refresh();
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} วันล้มเหลว: ${failed.map((f) => f.date).join(', ')}`);
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(dateStr: string) {
    try {
      const res = await fetch(`/api/sport/admin/fields/${fieldId}/blocked-dates`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      if (!res.ok) throw new Error('ลบไม่สำเร็จ');
      toast.success('ยกเลิกการบล็อกแล้ว');
      load();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const blockedISOList = dates.map((d) => d.date.slice(0, 10));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
      >
        วันปิด
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">วันที่ปิดสนาม</h2>
                <p className="text-xs text-gray-400 mt-0.5">{fieldName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <form onSubmit={handleAdd} className="space-y-4">
                <MiniCalendar
                  selectedDates={selectedDates}
                  blockedDates={blockedISOList}
                  onToggle={toggleDate}
                />

                {selectedDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDates.sort().map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium"
                      >
                        {new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        <button type="button" onClick={() => toggleDate(d)} className="text-primary-400 hover:text-red-500 transition">✕</button>
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    เหตุผล (ใช้กับทุกวันที่เลือก, ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 transition"
                    placeholder="เช่น ซ่อมสนาม, วันหยุดพิเศษ"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={adding || selectedDates.length === 0}
                  className="w-full gradient-btn py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                >
                  {adding ? 'กำลังบันทึก...' : `บล็อก ${selectedDates.length > 0 ? `${selectedDates.length} วัน` : 'วันที่เลือก'}`}
                </button>
              </form>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">วันที่บล็อกไว้ ({dates.length})</p>
                {loading ? (
                  <p className="text-xs text-gray-400 text-center py-4">กำลังโหลด...</p>
                ) : dates.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีวันที่ถูกบล็อก</p>
                ) : (
                  <div className="space-y-2">
                    {dates.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white">
                            {new Date(d.date).toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                          {d.reason && <p className="text-xs text-gray-400">{d.reason}</p>}
                        </div>
                        <button
                          onClick={() => handleDelete(d.date)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                          ลบ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
