'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Props {
  bookingId: string;
  initialDate: string; // ISO
  initialTimeSlot: string; // "HH:MM-HH:MM"
  children?: ReactNode; // custom trigger content; defaults to "✎ แก้เวลา" pill
  triggerClassName?: string;
  onSaved?: () => void; // called after a successful save (in addition to router.refresh)
  fieldId?: string; // current field id; enables the field-swap dropdown
  fieldName?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
}

export function EditBookingButton({ bookingId, initialDate, initialTimeSlot, children, triggerClassName, onSaved, fieldId, fieldName, customerName, customerPhone, note }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dateOnly = new Date(initialDate).toISOString().slice(0, 10);
  const [start, end] = initialTimeSlot.split('-');

  const [date, setDate] = useState(dateOnly);
  const [startTime, setStartTime] = useState(start ?? '');
  const [endTime, setEndTime] = useState(end ?? '');
  const [fields, setFields] = useState<{ id: string; name: string }[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState(fieldId ?? '');

  // Lazy-load the field list the first time the dialog opens (only if we know the current field).
  useEffect(() => {
    if (!open || !fieldId || fields.length > 0) return;
    fetch('/api/sport/fields')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setFields(Array.isArray(d) ? d.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })) : []))
      .catch(() => {});
  }, [open, fieldId, fields.length]);

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
          ...(fieldId && selectedFieldId ? { fieldId: selectedFieldId } : {}),
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
        className={triggerClassName ?? 'px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'}
      >
        {children ?? '✎ แก้เวลา'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !loading && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">แก้ไขการจอง</h3>
            {(customerName || customerPhone || note) && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs space-y-0.5">
                {(customerName || customerPhone) && (
                  <p className="text-gray-600 dark:text-gray-400">
                    👤 {customerName ?? '-'}{customerPhone ? ` · 📱 ${customerPhone}` : ''}
                  </p>
                )}
                {note && <p className="text-gray-500 dark:text-gray-400 italic">💬 {note}</p>}
              </div>
            )}
            <div className="space-y-3">
              {fieldId && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">สนาม</label>
                  <select
                    value={selectedFieldId}
                    onChange={(e) => setSelectedFieldId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {fields.length === 0 && fieldName && <option value={selectedFieldId}>{fieldName}</option>}
                    {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">วันที่</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">เริ่ม</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">สิ้นสุด</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
