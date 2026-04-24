import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('payment');
  return { title: t('successMeta') };
}

export default async function PaymentSuccessPage() {
  const t = await getTranslations('payment');
  return (
    <div className="wrapper py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="text-6xl mb-6">✅</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{t('successTitle')}</h1>
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
