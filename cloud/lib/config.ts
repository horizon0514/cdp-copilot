/** OpenRouter's OpenAI-compatible surface. Model ids are namespaced
 * (`openai/gpt-4.1-mini`, `anthropic/claude-sonnet-5`, …). */
export const ROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Sent as `HTTP-Referer` / `X-Title`, which is how OpenRouter attributes spend
 * to an app on its dashboard. Per-user attribution rides on the `user` field. */
export const APP_URL = 'https://pagehand.vercel.app';
export const APP_TITLE = 'Pagehand';

/** A step carrying a full a11y snapshot plus resent history is large but not
 * unbounded. Anything past this is a bug or an attack, not a real turn. */
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

/**
 * Which models a hosted request may ask for.
 *
 * Not a pricing concern — the router reports cost per request, so anything it
 * serves can be billed. This is a plan gate and a blast-radius limit: without it
 * a Free user could route every step through the most expensive frontier model
 * on the catalogue.
 */
export function allowedModels(): Set<string> {
  const raw = process.env.HOSTED_MODEL_ALLOWLIST?.trim();
  const list = raw
    ? raw.split(',').map((m) => m.trim()).filter(Boolean)
    : ['openai/gpt-4.1-mini', 'openai/gpt-4.1', 'anthropic/claude-sonnet-5'];
  return new Set(list);
}

export function routerApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  return key;
}
