import { Settings, SettingsSchema } from './schema';

const STORAGE_KEY = 'pagehand:settings';
const LEGACY_STORAGE_KEY = 'cdp-copilot:settings';

export async function getSettings(): Promise<Settings | null> {
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const raw = result[STORAGE_KEY] ?? result[LEGACY_STORAGE_KEY];
  if (!raw) return null;

  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) return null;

  // One-time migrate from the pre-rename key.
  if (!result[STORAGE_KEY] && result[LEGACY_STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: parsed.data });
    await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
  }

  return parsed.data;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const validated = SettingsSchema.parse(settings);
  await chrome.storage.local.set({ [STORAGE_KEY]: validated });
}

export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY, LEGACY_STORAGE_KEY]);
}
