import { Settings, SettingsSchema } from './schema';

const STORAGE_KEY = 'cdp-copilot:settings';

export async function getSettings(): Promise<Settings | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw) return null;

  const parsed = SettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const validated = SettingsSchema.parse(settings);
  await chrome.storage.local.set({ [STORAGE_KEY]: validated });
}

export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
