import { describe, it, expect } from 'vitest';
import th from '../messages/th.json';
import en from '../messages/en.json';
import my from '../messages/my.json';
import { LOCALES, DEFAULT_LOCALE } from './config';

type Msg = Record<string, unknown>;

function collectKeys(obj: Msg, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Msg, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('i18n messages', () => {
  it('all locale files have the same keys as th.json', () => {
    const thKeys = new Set(collectKeys(th));
    for (const [name, locale] of [['en', en], ['my', my]] as const) {
      const localeKeys = new Set(collectKeys(locale as Msg));
      const missing = [...thKeys].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !thKeys.has(k));
      expect({ [`missingIn_${name}`]: missing, [`extraIn_${name}`]: extra }).toEqual({
        [`missingIn_${name}`]: [],
        [`extraIn_${name}`]: [],
      });
    }
  });

  it('all message values are non-empty strings', () => {
    for (const locale of [th, en, my]) {
      for (const key of collectKeys(locale as Msg)) {
        const value = key.split('.').reduce<unknown>((acc, k) => (acc as Msg)?.[k], locale);
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('config exposes all supported locales', () => {
    expect(LOCALES).toEqual(['th', 'en', 'my']);
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });
});
