'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/sport';
  const t = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);

  const inputClass = "w-full h-12 rounded-full border border-gray-200 dark:border-gray-700 px-5 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn('credentials', {
      email,
      password,
      totpCode: needs2FA ? totpCode : undefined,
      redirect: false,
    });
    setLoading(false);

    if (res?.error === '2FA_REQUIRED') {
      setNeeds2FA(true);
      toast.info(t('error2faRequired'));
      return;
    }
    if (res?.error === '2FA_INVALID') {
      toast.error(t('error2faInvalid'));
      setTotpCode('');
      return;
    }
    if (res?.error) {
      toast.error(t('errorBadCredentials'));
    } else {
      toast.success(t('signinSuccess'));
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!needs2FA ? (
        <>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('email')}</label>
            <input
              type="email"
              className={inputClass}
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('password')}</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className={`${inputClass} pr-12`}
                placeholder={t('passwordHint')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-2">🔐</p>
            <p className="font-semibold text-gray-900 dark:text-white">{t('twoFaTitle')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('twoFaHint')}</p>
          </div>
          <input
            type="text"
            className={`${inputClass} text-center text-xl tracking-widest`}
            placeholder="000000"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            autoFocus
            required
          />
          <button
            type="button"
            onClick={() => { setNeeds2FA(false); setTotpCode(''); }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {t('backToSignin')}
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (needs2FA && totpCode.length !== 6)}
        className="w-full gradient-btn text-white font-semibold h-12 rounded-full text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
      >
        {loading ? t('signinLoading') : needs2FA ? t('confirm') : t('signinButton')}
      </button>

      {!needs2FA && (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400">
              <span className="bg-white dark:bg-gray-900 px-3">{t('orSigninWith')}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl })}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('signinGoogle')}
          </button>
        </>
      )}
    </form>
  );
}
