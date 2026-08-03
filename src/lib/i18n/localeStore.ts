import type { LocalePreference } from './index';

const STORAGE_KEY = 'cdp-copilot:locale';

export async function getLocalePreference(): Promise<LocalePreference> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (raw === 'en' || raw === 'zh' || raw === 'system') return raw;
  return 'system';
}

export async function saveLocalePreference(pref: LocalePreference): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: pref });
}

/** Notify listeners when the preference changes (other panels / background). */
export function onLocalePreferenceChanged(
  handler: (pref: LocalePreference) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    const next = changes[STORAGE_KEY].newValue;
    if (next === 'en' || next === 'zh' || next === 'system') handler(next);
    else if (next === undefined) handler('system');
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
