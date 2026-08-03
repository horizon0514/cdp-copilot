import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  resolveLocale,
  translate,
  translatePlural,
  type Locale,
  type LocalePreference,
  type MessageKey,
  type TranslateVars,
} from '../../lib/i18n';
import {
  getLocalePreference,
  onLocalePreferenceChanged,
  saveLocalePreference,
} from '../../lib/i18n/localeStore';

export type TFunction = (key: MessageKey, vars?: TranslateVars) => string;

interface I18nContextValue {
  locale: Locale;
  preference: LocalePreference;
  setPreference: (pref: LocalePreference) => Promise<void>;
  t: TFunction;
  tp: (key: MessageKey, count: number, vars?: TranslateVars) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>('system');
  const locale = resolveLocale(preference);

  useEffect(() => {
    void getLocalePreference().then(setPreferenceState);
    return onLocalePreferenceChanged(setPreferenceState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const setPreference = useCallback(async (pref: LocalePreference) => {
    setPreferenceState(pref);
    await saveLocalePreference(pref);
  }, []);

  const t = useCallback<TFunction>(
    (key, vars) => translate(locale, key, vars),
    [locale],
  );

  const tp = useCallback(
    (key: MessageKey, count: number, vars?: TranslateVars) =>
      translatePlural(locale, key, count, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, preference, setPreference, t, tp }),
    [locale, preference, setPreference, t, tp],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
