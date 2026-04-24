'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function ResendVerificationPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('auth');

  async function handleResend() {
    setLoading(true);
    try {
      const res = await fetch('/api/sport/auth/resend-verification', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <a href="/sport" className="text-4xl">🏟️</a>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{t('verifyEmailTitle')}</h1>
        <div className="mt-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700/50 shadow-theme-sm p-8 space-y-4">
          {sent ? (
            <>
              <div className="text-5xl">📧</div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">{t('verifyEmailSent')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('verifyEmailSentHint')}</p>
            </>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('verifyPromptHint')}</p>
              <button
                onClick={handleResend}
                disabled={loading}
                className="w-full gradient-btn text-white font-semibold h-12 rounded-full text-sm disabled:opacity-60"
              >
                {loading ? t('sending') : t('resendAgain')}
              </button>
            </>
          )}
          <a href="/sport" className="block text-sm text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition">
            {t('backHome')}
          </a>
        </div>
      </div>
    </div>
  );
}
