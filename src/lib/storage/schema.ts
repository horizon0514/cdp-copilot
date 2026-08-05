import { z } from 'zod';

export const ProviderId = z.enum(['hosted', 'deepseek', 'openai', 'anthropic', 'openai-compatible']);
export type ProviderId = z.infer<typeof ProviderId>;

/** DeepSeek speaks Chat Completions; its endpoint is fixed so the panel can skip
 * asking for a base URL, and the manifest can pre-grant the host. */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

/** Pagehand's own proxy. Overridable through the base URL field so a dev build
 * can point at `http://localhost:3000/api/v1`. */
export const HOSTED_BASE_URL = 'https://api.pagehand.app/v1';

/** True for the hosted path only: there is no user-held key, because the whole
 * point is that the gateway credential never leaves our server. */
export function isHosted(provider: ProviderId): boolean {
  return provider === 'hosted';
}

export const SettingsSchema = z.object({
  provider: ProviderId,
  // Optional because hosted mode has no key to store — authentication rides on
  // a session token injected per request instead (see llm/hostedFetch.ts).
  apiKey: z.string().optional(),
  model: z.string().min(1),
  baseURL: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  // Gateway model ids are namespaced by provider.
  hosted: 'openai/gpt-4.1-mini',
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-5',
  'openai-compatible': 'gpt-4.1',
};

/** What a first-run user lands on before touching the provider dropdown. */
export const DEFAULT_PROVIDER: ProviderId = 'deepseek';
