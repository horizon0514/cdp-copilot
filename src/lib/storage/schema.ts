import { z } from 'zod';

export const ProviderId = z.enum(['hosted', 'deepseek', 'openai', 'anthropic', 'openai-compatible']);
export type ProviderId = z.infer<typeof ProviderId>;

/** DeepSeek speaks Chat Completions; its endpoint is fixed so the panel can skip
 * asking for a base URL, and the manifest can pre-grant the host. */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

/**
 * Where hosted requests go.
 *
 * Never user-facing: there is nothing for a user to decide here, and a settings
 * field for it would only invite someone to point their chats at a stranger's
 * server. Dev builds target a local `cloud/` automatically so the proxy can be
 * worked on without deploying; `VITE_PAGEHAND_API_URL` covers the rest.
 */
export const HOSTED_BASE_URL: string =
  import.meta.env.VITE_PAGEHAND_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : 'https://pagehand.app/api/v1');

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

/**
 * What hosted mode may ask for. Router model ids are namespaced by provider;
 * this is the same DeepSeek model the BYOK default points at, reached through
 * Pagehand instead of a user key.
 *
 * Mirrors the server's allowlist by hand for now — the server rejects anything
 * outside it, so a free-text field here only lets people invent 403s. Phase 2
 * replaces this with the plan's real catalogue, fetched from `/api/me`.
 */
export const HOSTED_MODELS = ['deepseek/deepseek-v4-flash-0731'] as const;

/**
 * Repairs stored settings that hosted mode has since outgrown.
 *
 * Hosted's catalogue and endpoint belong to the server, but settings live in
 * `chrome.storage.local` and outlive any release. A model id saved before the
 * catalogue moved would be rejected with a 403 that reads as "the model is
 * broken", and it would keep being rejected until the user happened to reopen
 * Settings and press Save — so fix it on read instead of on write.
 *
 * BYOK is left alone: those ids are the user's business, not ours.
 */
export function normalizeSettings(settings: Settings): Settings {
  if (!isHosted(settings.provider)) return settings;

  const model = (HOSTED_MODELS as readonly string[]).includes(settings.model)
    ? settings.model
    : HOSTED_MODELS[0];
  // A base URL left behind by a BYOK setup would silently redirect hosted
  // traffic somewhere it was never meant to go.
  if (model === settings.model && settings.baseURL === undefined) return settings;
  return { ...settings, model, baseURL: undefined };
}

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  hosted: HOSTED_MODELS[0],
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-5',
  'openai-compatible': 'gpt-4.1',
};

/** Everything except hosted — the providers a user points at with their own key. */
export type ByokProviderId = Exclude<ProviderId, 'hosted'>;

/**
 * What a first-run user lands on before touching anything.
 *
 * Still BYOK, even though the UI now leads with hosted: hosted has no sign-in
 * yet (PLAN-subscription §7 Phase 1b), so defaulting a fresh install into it
 * would hand every new user a mode that cannot work. Flip this to `hosted` in
 * the same change that gates onboarding on being signed in.
 */
export const DEFAULT_PROVIDER: ByokProviderId = 'deepseek';
