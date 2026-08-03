import type { LocalePreference } from './index';

const STORAGE_KEY = 'pagehand:locale';
const LEGACY_STORAGE_KEY = 'cdp-copilot:locale';

function asPreference(raw: unknown): LocalePreference | null {
  if (raw === 'en' || raw === 'zh' || raw === 'system') return raw;
  return null;
}

export async function getLocalePreference(): Promise<LocalePreference> {
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const pref = asPreference(result[STORAGE_KEY]) ?? asPreference(result[LEGACY_STORAGE_KEY]);
  if (!pref) return 'system';

  if (!result[STORAGE_KEY] && result[LEGACY_STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: pref });
    await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
  }

  return pref;
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
    const next = asPreference(changes[STORAGE_KEY].newValue);
    handler(next ?? 'system');
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
