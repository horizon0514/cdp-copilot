import { FormEvent, useState } from 'react';
import { Settings, ProviderId, DEFAULT_MODELS } from '../../lib/storage/schema';
import { Label, SectionLabel } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-2.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint && <p className="-mt-0.5 text-[11px] leading-[1.45] text-fg-tertiary">{hint}</p>}
      {children}
    </div>
  );
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
    <form className="flex flex-1 flex-col gap-2 overflow-y-auto p-3" onSubmit={handleSubmit}>
      <SectionLabel>Model provider</SectionLabel>

      <div className="divide-y divide-line rounded-lg border border-line bg-surface">
        <Field label="Provider" htmlFor="provider">
          <Select value={provider} onValueChange={(v) => handleProviderChange(v as ProviderId)}>
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="API key" hint="Stored locally in this browser profile only, never synced." htmlFor="apiKey">
          <Input
            id="apiKey"
            type="password"
            placeholder="sk-…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
        </Field>

        <Field label="Model" htmlFor="model">
          <Input id="model" type="text" value={model} onChange={(e) => setModel(e.target.value)} required />
        </Field>

        <Field
          label={provider === 'openai-compatible' ? 'Base URL' : 'Base URL (optional)'}
          hint="Custom endpoints (OpenRouter, Azure, local Ollama) need a one-time permission grant."
          htmlFor="baseURL"
        >
          <Input
            id="baseURL"
            type="url"
            placeholder="https://…"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <div className="rounded-md border border-negative-line bg-negative-soft px-2.5 py-1.5 text-[11.5px] leading-[1.45] text-negative">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {initial && (
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
