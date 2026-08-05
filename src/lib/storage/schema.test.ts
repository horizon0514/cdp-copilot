import { describe, expect, it } from 'vitest';
import { HOSTED_MODELS, normalizeSettings, type Settings } from './schema';

const hosted = (over: Partial<Settings> = {}): Settings => ({
  provider: 'hosted',
  model: HOSTED_MODELS[0],
  ...over,
});

describe('normalizeSettings', () => {
  it('replaces a hosted model the server no longer accepts', () => {
    // The exact bug this exists for: settings saved against an older catalogue
    // kept sending a dead id, and every turn came back 403 until the user
    // happened to reopen Settings and press Save.
    const result = normalizeSettings(hosted({ model: 'deepseek/retired-model' }));
    expect(result.model).toBe(HOSTED_MODELS[0]);
  });

  it('drops a base URL left behind on hosted settings', () => {
    // A leftover from a BYOK setup would quietly route hosted traffic — and the
    // account's tokens — through someone else's endpoint.
    const result = normalizeSettings(hosted({ baseURL: 'http://localhost:3000/api/v1' }));
    expect(result.baseURL).toBeUndefined();
  });

  it('returns the same object when hosted settings are already valid', () => {
    // Cheap identity check keeps callers from treating every read as a change.
    const settings = hosted();
    expect(normalizeSettings(settings)).toBe(settings);
  });

  it('leaves BYOK settings untouched', () => {
    // Those ids and endpoints are the user's business; a model we don't
    // recognise there is normal, not stale.
    const byok: Settings = {
      provider: 'openai-compatible',
      apiKey: 'sk-test',
      model: 'some-local-model',
      baseURL: 'http://localhost:11434/v1',
    };
    expect(normalizeSettings(byok)).toBe(byok);
  });
});
