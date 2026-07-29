import { z } from 'zod';

export const ProviderId = z.enum(['openai', 'anthropic', 'openai-compatible']);
export type ProviderId = z.infer<typeof ProviderId>;

export const SettingsSchema = z.object({
  provider: ProviderId,
  apiKey: z.string().min(1),
  model: z.string().min(1),
  baseURL: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-5',
  'openai-compatible': 'gpt-4.1',
};
