'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface BookingDetail {
  fieldName: string;
  date: string;
  timeSlot: string;
}

export function SuccessContent() {
  const t = useTranslations('payment');
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const [detail, setDetail] = useState<BookingDetail | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/sport/bookings/${bookingId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((b: { field: { name: string }; date: string; timeSlot: string } | null) => {
        if (b) {
          setDetail({
            fieldName: b.field.name,
            date: new Date(b.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
            timeSlot: b.timeSlot,
          });
        }
      })
      .catch(() => {});
  }, [bookingId]);

  return (
    <div className="wrapper py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="text-6xl mb-6">✅</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{t('successTitle')}</h1>

      {detail && (
        <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-5 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">สนาม</span>
            <span className="font-medium text-gray-900 dark:text-white">{detail.fieldName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">วันที่</span>
            <span className="font-medium text-gray-900 dark:text-white">{detail.date}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">เวลา</span>
            <span className="font-semibold text-primary-600 dark:text-primary-400">{detail.timeSlot} น.</span>
          </div>
        </div>
      )}

      <p className="text-gray-500 dark:text-gray-400 mb-2">{t('successMsg')}</p>
      <p className="text-sm text-gray-400 mb-8">{t('successEmail')}</p>
      <Link
        href="/sport/bookings"
        className="px-6 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition"
      >
        {t('viewBookings')}
      </Link>
    </div>
  );
}
