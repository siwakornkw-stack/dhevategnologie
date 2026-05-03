'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

async function callUpdateStatus(bookingId: string, status: string) {
  const res = await fetch(`/api/sport/bookings/${bookingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'เกิดข้อผิดพลาด');
  }
}

export function AdminBookingActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(status: 'APPROVED' | 'REJECTED') {
    setLoading(status);
    try {
      await callUpdateStatus(bookingId, status);
      toast.success(status === 'APPROVED' ? 'อนุมัติการจองแล้ว ✓' : 'ปฏิเสธการจองแล้ว');
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => updateStatus('APPROVED')}
        disabled={!!loading}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 transition"
      >
        {loading === 'APPROVED' ? '...' : '✓ อนุมัติ'}
      </button>
      <button
        onClick={() => updateStatus('REJECTED')}
        disabled={!!loading}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition"
      >
        {loading === 'REJECTED' ? '...' : '✗ ปฏิเสธ'}
      </button>
    </div>
  );
}

export function AdminCancelAction({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleCancel() {
    if (!confirm) { setConfirm(true); return; }
    setLoading(true);
    try {
      await callUpdateStatus(bookingId, 'CANCELLED');
      toast.success('ยกเลิกการจองแล้ว');
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      onBlur={() => setConfirm(false)}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
        confirm
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400'
      }`}
    >
      {loading ? '...' : confirm ? 'ยืนยันยกเลิก?' : '✕ ยกเลิก'}
    </button>
  );
}
