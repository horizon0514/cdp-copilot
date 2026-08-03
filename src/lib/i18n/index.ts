import { en, type MessageKey, type Messages } from './en';
import { zh } from './zh';

export type Locale = 'en' | 'zh';
/** `system` follows the browser UI language. */
export type LocalePreference = Locale | 'system';

export type { MessageKey, Messages };
export { en, zh };

const catalogs: Record<Locale, Messages> = { en, zh };

export function browserLocale(): Locale {
  const raw =
    typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : typeof navigator !== 'undefined'
        ? navigator.language
        : 'en';
  return raw.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function resolveLocale(pref: LocalePreference): Locale {
  return pref === 'system' ? browserLocale() : pref;
}

export type TranslateVars = Record<string, string | number>;

/** Simple `{name}` interpolation. Missing vars are left as-is. */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: TranslateVars,
): string {
  const template = catalogs[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] != null ? String(vars[name]) : `{${name}}`,
  );
}

/** Plural helper for English-style `_plural` keys; Chinese reuses the same form. */
export function translatePlural(
  locale: Locale,
  key: MessageKey,
  count: number,
  vars?: TranslateVars,
): string {
  const pluralKey = `${key}_plural` as MessageKey;
  const usePlural = locale === 'en' && count !== 1 && pluralKey in catalogs[locale];
  return translate(locale, usePlural ? pluralKey : key, { count, ...vars });
}

export function messagesFor(locale: Locale): Messages {
  return catalogs[locale];
}
