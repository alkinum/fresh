import { describe, expect, it } from 'vitest';
import { defaultPreferences, parsePreferences, preferenceSchema, resolveLocale } from '../src/lib/preferences';
import { messages } from '../src/lib/messages';

describe('interface preferences', () => {
  it('uses explicit languages and negotiates weighted browser languages', () => {
    expect(resolveLocale('ja', 'zh-CN,en;q=0.8')).toBe('ja');
    expect(resolveLocale('auto', 'fr-FR,ko-KR;q=0.8,en;q=0.7')).toBe('ko');
    expect(resolveLocale('auto', 'en;q=0.5,ja-JP;q=0.9')).toBe('ja');
    expect(resolveLocale('auto', 'zh-TW,en;q=0.8')).toBe('zh-CN');
    expect(resolveLocale('auto', 'ko;q=0,en-US;q=0.9')).toBe('en');
    expect(resolveLocale('auto', 'de')).toBe('en');
  });

  it('rejects unsupported values and safely falls back for malformed persisted data', () => {
    expect(preferenceSchema.safeParse({ language: 'fr', theme: 'auto', accent: 'blue' }).success).toBe(false);
    expect(preferenceSchema.safeParse({ theme: 'unknown' }).success).toBe(false);
    expect(preferenceSchema.safeParse({ accent: 'red; background: url(test)' }).success).toBe(false);
    expect(parsePreferences({ theme: false })).toEqual(defaultPreferences);
    expect(parsePreferences(null)).toEqual(defaultPreferences);
  });

  it('provides every translated message in all three additional languages with matching interpolation', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const [source, translations] of Object.entries(messages)) {
      for (const locale of ['zh-CN', 'ko', 'ja'] as const) {
        expect(translations[locale].trim(), `${locale}: ${source}`).not.toBe('');
        expect(placeholders(translations[locale]), `${locale}: ${source}`).toEqual(placeholders(source));
      }
    }
  });
});
