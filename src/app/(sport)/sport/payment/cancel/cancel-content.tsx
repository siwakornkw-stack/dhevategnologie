'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function CancelContent() {
  const t = useTranslations('payment');
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const cancelled = useRef(false);

  useEffect(() => {
    if (!bookingId || cancelled.current) return;
    cancelled.current = true;
    fetch(`/api/sport/bookings/${bookingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    }).catch(() => {});
  }, [bookingId]);

  return (
    <div className="wrapper py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="text-6xl mb-6">❌</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{t('cancelTitle')}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">{t('cancelMsg')}</p>
      <div className="flex gap-3">
        <Link
          href="/sport"
          className="px-6 py-3 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold transition hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {t('backToHome')}
        </Link>
        <Link
          href="/sport/bookings"
          className="px-6 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition"
        >
          {t('myBookings')}
        </Link>
      </div>
    </div>
  );
}
