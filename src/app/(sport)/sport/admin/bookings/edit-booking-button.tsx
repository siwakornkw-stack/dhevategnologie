'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Props {
  bookingId: string;
  initialDate: string; // ISO
  initialTimeSlot: string; // "HH:MM-HH:MM"
  children?: ReactNode; // custom trigger content; defaults to "✎ แก้เวลา" pill
  triggerClassName?: string;
  onSaved?: () => void; // called after a successful save (in addition to router.refresh)
  fieldName?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
}

export function EditBookingButton({ bookingId, initialDate, initialTimeSlot, children, triggerClassName, onSaved, fieldName, customerName, customerPhone, note }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dateOnly = new Date(initialDate).toISOString().slice(0, 10);
  const [start, end] = initialTimeSlot.split('-');

  const [date, setDate] = useState(dateOnly);
  const [startTime, setStartTime] = useState(start ?? '');
  const [endTime, setEndTime] = useState(end ?? '');

  async function handleSave() {
    if (!date || !startTime || !endTime) {
      toast.error('กรอกวันที่และเวลาให้ครบ');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sport/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          timeSlot: `${startTime}-${endTime}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'แก้ไขไม่สำเร็จ');
      toast.success('แก้ไขการจองแล้ว ✓');
      setOpen(false);
      router.refresh();
      onSaved?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={triggerClassName ?? 'px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition'}
      >
        {children ?? '✎ แก้เวลา'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !loading && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">แก้ไขเวลาการจอง</h3>
            {(fieldName || customerName || customerPhone || note) && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs space-y-0.5">
                {fieldName && <p className="font-medium text-gray-800 dark:text-gray-200">🏟️ {fieldName}</p>}
                {(customerName || customerPhone) && (
                  <p className="text-gray-600 dark:text-gray-400">
                    👤 {customerName ?? '-'}{customerPhone ? ` · 📱 ${customerPhone}` : ''}
                  </p>
                )}
                {note && <p className="text-gray-500 dark:text-gray-400 italic">💬 {note}</p>}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">วันที่</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">เริ่ม</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">สิ้นสุด</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
