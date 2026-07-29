import { FormEvent, useState } from 'react';
import { Settings, ProviderId, DEFAULT_MODELS } from '../../lib/storage/schema';

const DEFAULT_HOST_ORIGINS = new Set(['https://api.openai.com', 'https://api.anthropic.com']);

interface Props {
  initial: Settings | null;
  onSave: (settings: Settings) => Promise<void>;
  onClose: () => void;
}

async function ensureHostPermission(baseURL: string | undefined): Promise<void> {
  if (!baseURL) return;
  const origin = new URL(baseURL).origin;
  if (DEFAULT_HOST_ORIGINS.has(origin)) return;

  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) throw new Error(`Permission for ${origin} was not granted — can't use this endpoint.`);
}

export default function SettingsPanel({ initial, onSave, onClose }: Props) {
  const [provider, setProvider] = useState<ProviderId>(initial?.provider ?? 'openai');
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
  const [model, setModel] = useState(initial?.model ?? DEFAULT_MODELS.openai);
  const [baseURL, setBaseURL] = useState(initial?.baseURL ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleProviderChange = (next: ProviderId) => {
    setProvider(next);
    if (!initial || initial.provider !== next) setModel(DEFAULT_MODELS[next]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const trimmedBaseURL = baseURL.trim() || undefined;
      await ensureHostPermission(trimmedBaseURL);
      await onSave({ provider, apiKey: apiKey.trim(), model: model.trim(), baseURL: trimmedBaseURL });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-panel" onSubmit={handleSubmit}>
      <label>
        Provider
        <select value={provider} onChange={(e) => handleProviderChange(e.target.value as ProviderId)}>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai-compatible">OpenAI-compatible (custom base URL)</option>
        </select>
      </label>

      <label>
        API key
        <span className="hint">Stored locally in this browser profile only, never synced.</span>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
      </label>

      <label>
        Model
        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} required />
      </label>

      <label>
        Base URL {provider === 'openai-compatible' ? '' : '(optional override)'}
        <span className="hint">
          Custom endpoints (OpenRouter, Azure OpenAI, local Ollama, etc.) need an extra one-time permission
          grant.
        </span>
        <input
          type="url"
          placeholder="https://..."
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
        />
      </label>

      {error && <div className="banner error">{error}</div>}

      <button className="save-button" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
