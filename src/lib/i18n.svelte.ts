import { getContext, setContext } from 'svelte';
import { defaultPreferences, resolveLocale, type Preferences } from './preferences';
import { messages } from './messages';

export class I18n {
  preferences = $state<Preferences>({ ...defaultPreferences });
  acceptedLanguages = $state('');

  constructor(preferences: Preferences, acceptedLanguages: string) {
    this.preferences = preferences;
    this.acceptedLanguages = acceptedLanguages;
  }

  get locale() {
    return resolveLocale(this.preferences.language, this.acceptedLanguages);
  }

  t = (message: string, values: Record<string, string | number> = {}): string => {
    const translated = this.locale === 'en' ? message : (messages[message]?.[this.locale] ?? message);
    return translated.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
  };
}

export function provideI18n(preferences: Preferences, acceptedLanguages: string): I18n {
  return setContext('fresh-i18n', new I18n(preferences, acceptedLanguages));
}

export function useI18n(): I18n {
  return getContext<I18n>('fresh-i18n');
}
