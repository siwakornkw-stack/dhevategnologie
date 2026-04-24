import { describe, it, expect } from 'vitest';
import th from '../messages/th.json';
import en from '../messages/en.json';
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
  it('th.json and en.json have the same keys', () => {
    const thKeys = new Set(collectKeys(th));
    const enKeys = new Set(collectKeys(en));
    const missingInEn = [...thKeys].filter((k) => !enKeys.has(k));
    const missingInTh = [...enKeys].filter((k) => !thKeys.has(k));
    expect({ missingInEn, missingInTh }).toEqual({ missingInEn: [], missingInTh: [] });
  });

  it('all message values are non-empty strings', () => {
    for (const locale of [th, en]) {
      for (const key of collectKeys(locale)) {
        const value = key.split('.').reduce<unknown>((acc, k) => (acc as Msg)?.[k], locale);
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('config exposes both supported locales', () => {
    expect(LOCALES).toEqual(['th', 'en']);
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });
});
