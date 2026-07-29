import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Settings } from '../storage/schema';

export function resolveModel(settings: Settings): LanguageModel {
  switch (settings.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: settings.apiKey,
        baseURL: settings.baseURL,
        // Required for direct browser fetches even though host_permissions
        // already exempts extension pages from page-level CORS — this is
        // what @ai-sdk/anthropic expects for any non-Node fetch context.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      });
      return anthropic(settings.model);
    }
    case 'openai':
    case 'openai-compatible': {
      const openai = createOpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.baseURL,
      });
      return openai(settings.model);
    }
  }
}
