import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SignInForm } from './signin-form';

export const metadata = { title: 'Sign in' };

interface PageProps { searchParams: Promise<{ verified?: string; reset?: string }> }

export default async function SportSignInPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session) redirect('/sport');
  const { verified, reset } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/sport" className="text-4xl">🏟️</a>
          <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{t('signinTitle')}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">{t('signinSubtitle')}</p>
        </div>

        {verified === '1' && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm text-center">
            {t('verifiedOk')}
          </div>
        )}
        {reset === '1' && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm text-center">
            {t('resetOk')}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700/50 shadow-theme-sm p-8">
          <Suspense fallback={<div className="animate-pulse space-y-4">{Array.from({length:3}).map((_,i)=><div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-full"/>)}</div>}>
            <SignInForm />
          </Suspense>
          <p className="mt-4 text-center text-sm">
            <a href="/sport/auth/forgot-password" className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition">
              {t('forgotLink')}
            </a>
          </p>
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('noAccount')}{' '}
            <a href="/sport/auth/signup" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
              {t('signupButton')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
