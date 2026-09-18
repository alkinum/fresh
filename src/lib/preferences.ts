import { z } from 'zod';

export const locales = ['en', 'zh-CN', 'ko', 'ja'] as const;
export type Locale = (typeof locales)[number];
export const preferenceSchema = z.object({
  language: z.enum(['auto', ...locales]).default('auto'),
  theme: z.enum(['auto', 'light', 'dark']).default('auto'),
  accent: z.enum(['blue', 'green', 'violet', 'rose', 'orange']).default('blue'),
});
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences: Preferences = preferenceSchema.parse({});
export const preferenceCookie = 'fresh-preferences';

export function parsePreferences(value: unknown): Preferences {
  const result = preferenceSchema.safeParse(value);
  return result.success ? result.data : { ...defaultPreferences };
}

export function resolveLocale(language: Preferences['language'], accepted = ''): Locale {
  if (language !== 'auto') return language;
  const candidates = accepted
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().split(';');
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
      return { tag: tag.toLowerCase(), quality: quality ? Number(quality.trim().slice(2)) : 1, index };
    })
    .filter((item) => item.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of candidates) {
    if (tag === 'zh' || tag.startsWith('zh-')) return 'zh-CN';
    for (const locale of ['en', 'ko', 'ja'] as const) {
      if (tag === locale || tag.startsWith(`${locale}-`)) return locale;
    }
  }
  return 'en';
}
