'use server';

import { revalidatePath } from 'next/cache';
import { setUserLocale } from './locale';
import type { Locale } from './config';

export async function switchLocaleAction(locale: Locale) {
  await setUserLocale(locale);
  revalidatePath('/', 'layout');
}
