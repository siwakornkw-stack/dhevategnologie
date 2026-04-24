'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function SportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="wrapper py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('error')}</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{t('errorHint')}</p>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition"
      >
        {t('retry')}
      </button>
    </div>
  );
}
