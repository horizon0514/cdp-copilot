import { FormEvent, useState } from 'react';
import { Settings, ProviderId, DEFAULT_MODELS } from '../../lib/storage/schema';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
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
    <form className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4" onSubmit={handleSubmit}>
      <h2 className="text-sm font-semibold">Settings</h2>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as ProviderId)}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-compatible (custom base URL)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apiKey">API key</Label>
            <p className="text-[11px] font-normal text-muted-foreground">
              Stored locally in this browser profile only, never synced.
            </p>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">Model</Label>
            <Input id="model" type="text" value={model} onChange={(e) => setModel(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baseURL">
              Base URL {provider === 'openai-compatible' ? '' : '(optional override)'}
            </Label>
            <p className="text-[11px] font-normal text-muted-foreground">
              Custom endpoints (OpenRouter, Azure OpenAI, local Ollama, etc.) need an extra one-time permission
              grant.
            </p>
            <Input
              id="baseURL"
              type="url"
              placeholder="https://..."
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive-border bg-destructive-bg px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={saving} className="self-start">
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
