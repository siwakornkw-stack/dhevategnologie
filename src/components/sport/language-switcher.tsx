'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { switchLocaleAction } from '@/i18n/actions';
import type { Locale } from '@/i18n/config';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('language');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const options: { code: Locale; label: string; flag: string }[] = [
    { code: 'th', label: t('th'), flag: '🇹🇭' },
    { code: 'en', label: t('en'), flag: '🇬🇧' },
    { code: 'my', label: t('my'), flag: '🇲🇲' },
  ];

  const current = options.find((o) => o.code === locale) ?? options[0];

  function handleSelect(code: Locale) {
    setOpen(false);
    if (code === locale) return;
    startTransition(() => {
      switchLocaleAction(code);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
        aria-label={t('switcher')}
      >
        <span>{current.flag}</span>
        <span className="hidden sm:block text-gray-700 dark:text-gray-300 text-xs font-medium uppercase">
          {current.code}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-36 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-theme-lg py-1 z-50">
            {options.map((o) => (
              <button
                key={o.code}
                onClick={() => handleSelect(o.code)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  o.code === locale ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <span>{o.flag}</span>
                <span>{o.label}</span>
                {o.code === locale && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
