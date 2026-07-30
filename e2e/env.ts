import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads .env.local into process.env on the Node side only.
 *
 * Vite would also pick this file up, but only VITE_-prefixed keys reach the
 * client bundle — so an unprefixed key here never ends up in the built
 * extension. Kept dependency-free; this handles the KEY=VALUE subset we need.
 */
export function loadLocalEnv(): void {
  const file = path.join(import.meta.dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return;

  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && value && process.env[key] === undefined) process.env[key] = value;
  }
}

export interface LiveLlmConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

/** Returns null when no key is configured, so the live test can skip cleanly. */
export function liveLlmConfig(): LiveLlmConfig | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    baseURL: process.env.LLM_BASE_URL?.trim() || 'https://api.deepseek.com/v1',
    model: process.env.LLM_MODEL?.trim() || 'deepseek-chat',
  };
}
