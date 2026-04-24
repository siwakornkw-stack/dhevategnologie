'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const t = useTranslations('booking');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sport/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) throw new Error(t('cancel.apiError'));
      toast.success(t('cancel.success'));
      router.refresh();
    } catch {
      toast.error(t('cancel.error'));
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{t('cancel.sure')}</span>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          {loading ? t('cancel.cancelling') : tCommon('confirm')}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-gray-400 hover:text-gray-600">
          {t('cancel.no')}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
    >
      {t('cancel.button')}
    </button>
  );
}
