'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('auth');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/sport/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast.error(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/sport" className="text-4xl">🏟️</a>
          <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{t('forgotTitle')}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">{t('forgotSubtitle')}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700/50 shadow-theme-sm p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('checkInbox')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('forgotSuccessMsg', { email })}
              </p>
              <p className="text-xs text-gray-400">{t('linkExpires1h')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('email')}</label>
                <input
                  type="email"
                  className="w-full h-12 rounded-full border border-gray-200 dark:border-gray-700 px-5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 transition"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full gradient-btn text-white font-semibold h-12 rounded-full text-sm disabled:opacity-60"
              >
                {loading ? t('sending') : t('sendResetLink')}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-sm">
            <a href="/sport/auth/signin" className="text-primary-600 dark:text-primary-400 hover:underline">
              {t('backToSignin')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
