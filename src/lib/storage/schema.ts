import { z } from 'zod';

export const ProviderId = z.enum(['deepseek', 'openai', 'anthropic', 'openai-compatible']);
export type ProviderId = z.infer<typeof ProviderId>;

/** DeepSeek speaks Chat Completions; its endpoint is fixed so the panel can skip
 * asking for a base URL, and the manifest can pre-grant the host. */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export const SettingsSchema = z.object({
  provider: ProviderId,
  apiKey: z.string().min(1),
  model: z.string().min(1),
  baseURL: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-5',
  'openai-compatible': 'gpt-4.1',
};

/** What a first-run user lands on before touching the provider dropdown. */
export const DEFAULT_PROVIDER: ProviderId = 'deepseek';
