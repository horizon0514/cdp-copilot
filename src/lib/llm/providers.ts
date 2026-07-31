import { wrapLanguageModel, defaultSettingsMiddleware, type LanguageModel } from 'ai';
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
    case 'openai': {
      const openai = createOpenAI({
        apiKey: settings.apiKey,
        // Optional here: an Azure/gateway deployment that speaks Responses can
        // be pointed at, and every request path (including /responses) is
        // rebased onto it.
        baseURL: settings.baseURL,
      });
      // Responses API — the system prompt reaches it through streamText's
      // top-level `instructions` option, so nothing has to live in `messages`.
      //
      // `store` MUST stay false. It defaults to true, and with it on the SDK
      // replaces every previously-answered assistant message with a bare
      // `{ type: 'item_reference', id }` and drops the text, trusting the
      // server to still hold that item. Anything that isn't OpenAI itself —
      // a gateway, DeepSeek, an Azure deployment — can't resolve those ids, so
      // the whole answer history silently evaporates and the model, seeing
      // only a pile of unanswered questions, replies to the oldest one.
      // Sending content inline also keeps conversations (page text included)
      // off the provider's servers and survives threads reloaded from
      // IndexedDB long after any server-side item would have expired.
      return wrapLanguageModel({
        model: openai.responses(settings.model),
        middleware: defaultSettingsMiddleware({
          settings: { providerOptions: { openai: { store: false } } },
        }),
      });
    }
    case 'openai-compatible': {
      const openai = createOpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.baseURL,
      });
      // Chat Completions is what virtually every third-party "OpenAI-compatible"
      // server (Ollama, vLLM, OpenRouter, LiteLLM, ...) actually implements;
      // /responses is still rare outside OpenAI itself.
      return openai.chat(settings.model);
    }
  }
}
