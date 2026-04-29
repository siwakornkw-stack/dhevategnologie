import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CancelContent } from './cancel-content';

export async function generateMetadata() {
  const t = await getTranslations('payment');
  return { title: t('cancelMeta') };
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="wrapper py-20 text-center text-gray-400">...</div>}>
      <CancelContent />
    </Suspense>
  );
}
