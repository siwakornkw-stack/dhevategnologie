'use server';

import { cookies } from 'next/headers';
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from './config';

export async function getUserLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return (LOCALES as string[]).includes(value ?? '') ? (value as Locale) : DEFAULT_LOCALE;
}

export async function setUserLocale(locale: Locale) {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
