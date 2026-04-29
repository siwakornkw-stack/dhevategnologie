import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { SuccessContent } from './success-content';

export async function generateMetadata() {
  const t = await getTranslations('payment');
  return { title: t('successMeta') };
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="wrapper py-20 text-center text-gray-400">...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
