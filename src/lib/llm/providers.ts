import { wrapLanguageModel, defaultSettingsMiddleware, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { DEEPSEEK_BASE_URL, HOSTED_BASE_URL, Settings } from '../storage/schema';
import { createHostedFetch } from './hostedFetch';

export function resolveModel(settings: Settings): LanguageModel {
  switch (settings.provider) {
    case 'hosted': {
      const pagehand = createOpenAI({
        // Deliberately absent: the hosted path carries no user-held key. Auth is
        // a session token injected per request, because a static apiKey would be
        // captured once and expire mid-turn — see hostedFetch.ts.
        apiKey: '',
        baseURL: settings.baseURL ?? HOSTED_BASE_URL,
        fetch: createHostedFetch(),
      });
      // Chat Completions: our proxy is OpenAI-compatible by design, so the
      // multi-step tool loop keeps running in the panel and each step is one
      // ordinary request. Nothing about agentLoop changes.
      return pagehand.chat(settings.model);
    }
    case 'deepseek': {
      const deepseek = createOpenAI({
        apiKey: settings.apiKey,
        // Overridable so a proxy or a regional endpoint can stand in.
        baseURL: settings.baseURL ?? DEEPSEEK_BASE_URL,
      });
      // Chat Completions, not /responses — DeepSeek doesn't serve the latter.
      return deepseek.chat(settings.model);
    }
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
