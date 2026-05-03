'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { generateTimeSlots, formatDateISO, SPORT_TYPE_EMOJI } from '@/lib/booking';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/sport/date-picker';

interface Field {
  id: string;
  name: string;
  sportType: string;
  pricePerHour: number;
  openTime: string;
  closeTime: string;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(time: string, minutes: number): string {
  const total = toMin(time) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatDurationMin(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} ชม.`;
  if (h === 0) return `${m} นาที`;
  return `${h} ชม. ${m} นาที`;
}

const MIN_STEP = 5;

function isSlotOverlapping(slot: string, booked: Record<string, string>): boolean {
  const [s, e] = slot.split('-');
  const slotStart = toMin(s);
  const slotEnd = toMin(e);
  return Object.keys(booked).some((key) => {
    const [ks, ke] = key.split('-');
    return slotStart < toMin(ke) && slotEnd > toMin(ks);
  });
}

function TimeSelect({
  value,
  onChange,
  minTime,
  maxTime,
}: {
  value: string;
  onChange: (t: string) => void;
  minTime: string;
  maxTime: string;
}) {
  const minMin = toMin(minTime);
  const maxMin = toMin(maxTime);
  const curMin = Math.max(minMin, Math.min(maxMin, toMin(value)));
  const hVal = Math.floor(curMin / 60);
  const mVal = curMin % 60;

  const hours = Array.from({ length: 24 }, (_, i) => i).filter(
    (hr) => hr * 60 + (60 - MIN_STEP) >= minMin && hr * 60 <= maxMin
  );

  const minutes = Array.from({ length: 60 / MIN_STEP }, (_, i) => i * MIN_STEP).filter((mn) => {
    const total = hVal * 60 + mn;
    return total >= minMin && total <= maxMin;
  });

  function handleHourChange(newH: number) {
    let total = newH * 60 + mVal;
    total = Math.max(minMin, Math.min(maxMin, total));
    const clampedM = Math.floor((total % 60) / MIN_STEP) * MIN_STEP;
    onChange(`${String(newH).padStart(2, '0')}:${String(clampedM).padStart(2, '0')}`);
  }

  const selectCls =
    'rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-center w-full';

  return (
    <div className="flex items-center gap-1">
      <select value={hVal} onChange={(e) => handleHourChange(Number(e.target.value))} className={selectCls}>
        {hours.map((hr) => (
          <option key={hr} value={hr}>{String(hr).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-gray-400 font-bold text-sm">:</span>
      <select
        value={mVal}
        onChange={(e) => onChange(`${String(hVal).padStart(2, '0')}:${String(Number(e.target.value)).padStart(2, '0')}`)}
        className={selectCls}
      >
        {minutes.map((mn) => (
          <option key={mn} value={mn}>{String(mn).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  );
}

export function AvailabilityClient() {
  const today = formatDateISO(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [fields, setFields] = useState<Field[]>([]);
  const [availability, setAvailability] = useState<Record<string, Record<string, string>>>({});
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingAvail, setLoadingAvail] = useState(false);

  // Dialog state
  const [dialog, setDialog] = useState<{ field: Field; slot: string } | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch all active fields once
  useEffect(() => {
    fetch('/api/sport/fields')
      .then((r) => r.json())
      .then((data) => setFields(Array.isArray(data) ? data : data.fields ?? []))
      .catch(() => setFields([]))
      .finally(() => setLoadingFields(false));
  }, []);

  // Fetch availability for all fields when date or fields change
  const fetchAvailability = useCallback(async (date: string, fieldList: Field[]) => {
    if (!fieldList.length) return;
    setLoadingAvail(true);
    const results = await Promise.all(
      fieldList.map((f) =>
        fetch(`/api/sport/fields/${f.id}/availability?date=${date}`)
          .then((r) => r.json())
          .then((d) => ({ id: f.id, bookedSlots: d.bookedSlots ?? {} }))
          .catch(() => ({ id: f.id, bookedSlots: {} }))
      )
    );
    const map: Record<string, Record<string, string>> = {};
    results.forEach(({ id, bookedSlots }) => { map[id] = bookedSlots; });
    setAvailability(map);
    setLoadingAvail(false);
  }, []);

  useEffect(() => {
    if (fields.length) fetchAvailability(selectedDate, fields);
  }, [selectedDate, fields, fetchAvailability]);

  function openDialog(field: Field, slot: string) {
    const slotStart = slot.split('-')[0];
    const defaultEnd = addMinutesToTime(slotStart, 60);
    const clampedEnd = toMin(defaultEnd) <= toMin(field.closeTime) ? defaultEnd : field.closeTime;
    setDialog({ field, slot });
    setStartTime(slotStart);
    setEndTime(clampedEnd);
    setNote('');
  }

  function closeDialog() {
    setDialog(null);
  }

  const dialogDurationMin = startTime && endTime ? toMin(endTime) - toMin(startTime) : 0;
  const dialogTotalHours = dialogDurationMin / 60;
  const dialogPrice = dialog ? dialog.field.pricePerHour * dialogTotalHours : 0;
  const dialogFullSlot = startTime && endTime ? `${startTime}-${endTime}` : null;

  // Check if selected range overlaps any booked slot
  const hasConflict = (() => {
    if (!dialog || !startTime || !endTime || dialogDurationMin <= 0) return false;
    const startMin = toMin(startTime);
    const endMin = toMin(endTime);
    const booked = availability[dialog.field.id] ?? {};
    return Object.keys(booked).some((slotKey) => {
      const [s, e] = slotKey.split('-');
      return startMin < toMin(e) && endMin > toMin(s);
    });
  })();

  const isValidRange =
    dialog &&
    startTime &&
    endTime &&
    dialogDurationMin >= MIN_STEP &&
    toMin(startTime) >= toMin(dialog.field.openTime) &&
    toMin(endTime) <= toMin(dialog.field.closeTime);

  async function handleBook() {
    if (!dialog || !dialogFullSlot || !isValidRange) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/sport/admin/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: dialog.field.id,
          date: selectedDate,
          timeSlot: dialogFullSlot,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'เกิดข้อผิดพลาด');
      toast.success(`จองสำเร็จ! ${dialog.field.name} ${dialogFullSlot} น.`);
      closeDialog();
      const r = await fetch(`/api/sport/fields/${dialog.field.id}/availability?date=${selectedDate}`);
      const d = await r.json();
      setAvailability((prev) => ({ ...prev, [dialog!.field.id]: d.bookedSlots ?? {} }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingFields) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">เลือกวันที่</h2>
        <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {/* Field Availability Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            สนามทั้งหมด ({fields.length} สนาม)
          </h2>
          {loadingAvail && (
            <span className="text-xs text-gray-400 animate-pulse">กำลังโหลดเวลาว่าง...</span>
          )}
        </div>

        {fields.length === 0 ? (
          <div className="p-12 text-center text-gray-400">ไม่พบสนาม</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {fields.map((field) => {
              const allSlots = generateTimeSlots(field.openTime, field.closeTime);
              const booked = availability[field.id] ?? {};
              const availableSlots = allSlots.filter((s) => !isSlotOverlapping(s, booked));

              return (
                <div key={field.id} className="px-5 py-4">
                  {/* Field Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/10 to-primary-600/20 flex items-center justify-center text-xl flex-shrink-0">
                      {SPORT_TYPE_EMOJI[field.sportType] ?? '🏟️'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{field.name}</p>
                      <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                        ฿{field.pricePerHour.toLocaleString()}/ชม. · {field.openTime}–{field.closeTime}
                      </p>
                    </div>
                    <div className="ml-auto text-xs text-gray-400">
                      ว่าง {availableSlots.length}/{allSlots.length} ช่อง
                    </div>
                  </div>

                  {/* Available Slots */}
                  {availableSlots.length === 0 ? (
                    <div className="text-sm text-gray-400 italic px-1">เต็มทุกช่วงเวลา</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allSlots.map((slot) => {
                        const isBooked = isSlotOverlapping(slot, booked);
                        const slotStart = slot.split('-')[0];
                        return (
                          <button
                            key={slot}
                            onClick={() => !isBooked && openDialog(field, slot)}
                            disabled={isBooked || loadingAvail}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              isBooked
                                ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 hover:border-green-300 cursor-pointer'
                            )}
                          >
                            {slotStart}
                            {isBooked && <span className="ml-1 opacity-60">x</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      {dialog && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeDialog()}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-4">
              จองสนาม
            </h3>

            {/* Field + Date summary */}
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">สนาม</span>
                <span className="font-medium text-gray-900 dark:text-white">{dialog.field.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {dialogDurationMin > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">เวลา</span>
                    <span className="font-semibold text-primary-600 dark:text-primary-400">
                      {startTime}–{endTime} น. ({formatDurationMin(dialogDurationMin)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ราคา</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ฿{dialogPrice % 1 === 0 ? dialogPrice.toLocaleString() : dialogPrice.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Time range pickers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">เวลาเริ่ม</label>
                <TimeSelect
                  value={startTime}
                  minTime={dialog.field.openTime}
                  maxTime={addMinutesToTime(dialog.field.closeTime, -MIN_STEP)}
                  onChange={(t) => {
                    setStartTime(t);
                    if (endTime && toMin(endTime) <= toMin(t)) {
                      setEndTime(addMinutesToTime(t, 60));
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">เวลาสิ้นสุด</label>
                <TimeSelect
                  value={endTime}
                  minTime={addMinutesToTime(startTime || dialog.field.openTime, MIN_STEP)}
                  maxTime={dialog.field.closeTime}
                  onChange={setEndTime}
                />
              </div>
            </div>

            {/* Validation messages */}
            {hasConflict && isValidRange && (
              <p className="text-xs text-orange-500 mb-3">ช่วงเวลานี้ซ้อนทับกับการจองที่มีอยู่</p>
            )}

            {/* Note */}
            <div className="mb-5">
              <label className="text-xs text-gray-500 mb-1 block">หมายเหตุ (ชื่อลูกค้า / เบอร์โทร)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น คุณสมชาย 081-234-5678"
                rows={2}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={closeDialog}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleBook}
                disabled={submitting || !isValidRange || hasConflict}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'กำลังจอง...' : 'จองและอนุมัติ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
