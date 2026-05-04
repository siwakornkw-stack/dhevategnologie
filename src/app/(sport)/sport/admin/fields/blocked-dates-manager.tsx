'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

export function BlockedDatesManager({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return toast.error('กรุณาเลือกวันที่');
    setAdding(true);
    try {
      const res = await fetch(`/api/sport/admin/fields/${fieldId}/blocked-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('บล็อกวันที่แล้ว');
      setDate('');
      setReason('');
      load();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
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

  const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 transition';

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
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">วันที่ปิดสนาม</h2>
                <p className="text-xs text-gray-400 mt-0.5">{fieldName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-lg">
                X
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">เลือกวันที่ปิด</label>
                  <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">เหตุผล (ไม่บังคับ)</label>
                  <input type="text" className={inputCls} placeholder="เช่น ซ่อมสนาม, วันหยุดพิเศษ" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <button
                  type="submit"
                  disabled={adding}
                  className="w-full gradient-btn py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                >
                  {adding ? 'กำลังบันทึก...' : 'บล็อกวันที่นี้'}
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
