'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SPORT_TYPE_EMOJI } from '@/lib/booking';
import { BookingStatusBadge } from '@/components/sport/booking-status-badge';
import { AdminBookingActions } from './admin-booking-actions';
import { EditBookingButton } from './edit-booking-button';

interface Booking {
  id: string;
  date: Date;
  timeSlot: string;
  status: string;
  note: string | null;
  paidAt?: Date | null;
  createdAt: Date;
  user: { name: string | null; email: string; phone: string | null };
  field: { name: string; sportType: string };
}

export function PendingBookingsSection({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === bookings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(bookings.map((b) => b.id)));
    }
  }

  async function handleBulk(status: 'APPROVED' | 'REJECTED') {
    if (selected.size === 0) return;
    const label = status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
    if (!confirm(`${label} ${selected.size} รายการที่เลือก?`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/sport/admin/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${label} ${data.updated} รายการสำเร็จ`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkLoading(false);
    }
  }

  if (bookings.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-yellow-200 dark:border-yellow-800/30 flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.size === bookings.length && bookings.length > 0}
            onChange={toggleAll}
            className="w-4 h-4 accent-primary-600"
          />
          <span className="text-yellow-600 dark:text-yellow-400 font-semibold text-sm">
            ⏳ รอการอนุมัติ ({bookings.length}) — {selected.size > 0 ? `เลือก ${selected.size} รายการ` : 'กรุณาโทรยืนยันลูกค้าก่อนอนุมัติ'}
          </span>
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulk('APPROVED')}
              disabled={bulkLoading}
              className="px-3 py-1 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50 transition"
            >
              {bulkLoading ? '...' : `✓ อนุมัติ ${selected.size} รายการ`}
            </button>
            <button
              onClick={() => handleBulk('REJECTED')}
              disabled={bulkLoading}
              className="px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-semibold disabled:opacity-50 transition"
            >
              {bulkLoading ? '...' : `✕ ปฏิเสธ ${selected.size} รายการ`}
            </button>
          </div>
        )}
      </div>

      <div className="divide-y divide-yellow-100 dark:divide-yellow-800/20">
        {bookings.map((booking) => (
          <div key={booking.id} className="px-5 py-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected.has(booking.id)}
              onChange={() => toggleSelect(booking.id)}
              className="w-4 h-4 mt-1 accent-primary-600 flex-shrink-0"
            />
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl flex-shrink-0 mt-0.5">
              {SPORT_TYPE_EMOJI[booking.field.sportType]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{booking.field.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(booking.date).toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' })} · {booking.timeSlot} น.
                  </p>
                </div>
                <BookingStatusBadge status={booking.status} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                <span>👤 {booking.user.name ?? booking.user.email}</span>
                {booking.user.phone && (
                  <a href={`tel:${booking.user.phone}`} className="text-green-600 dark:text-green-400 hover:underline">
                    📱 {booking.user.phone}
                  </a>
                )}
                {booking.paidAt && <span className="text-green-600 dark:text-green-400">✓ ชำระแล้ว</span>}
              </div>
              {booking.note && <p className="text-xs text-gray-400 mt-0.5 italic">💬 {booking.note}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AdminBookingActions bookingId={booking.id} />
                <EditBookingButton
                  bookingId={booking.id}
                  initialDate={new Date(booking.date).toISOString()}
                  initialTimeSlot={booking.timeSlot}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
