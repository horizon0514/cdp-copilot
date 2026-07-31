import {
  streamText,
  stepCountIs,
  type ModelMessage,
  type LanguageModel,
  type ToolSet,
  type AssistantModelMessage,
  type ToolModelMessage,
} from 'ai';
import { tools } from '../tools';
import { resolveModel } from './providers';
import { Settings } from '../storage/schema';
import { sanitizeModelMessages } from './sanitizeMessages';

/** Assistant + tool messages produced by a single streamText call. */
export type TurnResponseMessage = AssistantModelMessage | ToolModelMessage;

export type AgentEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; name: string; result: unknown }
  | { type: 'tool-error'; toolCallId: string; name: string; error: string }
  | { type: 'done'; stop: StopInfo; responseMessages: TurnResponseMessage[] }
  | { type: 'error'; message: string };

/** Why the turn ended — without this there's no way to tell a model that chose
 * to stop from a step-limit cutoff, a truncated response, or a provider error. */
export interface StopInfo {
  finishReason: string;
  steps: number;
  hitStepLimit: boolean;
  totalTokens?: number;
}

// The identity line is load-bearing: without it a model answers "who are you"
// from its own training data, and several models served through the
// openai-compatible path (DeepSeek among them) claim to be Claude or GPT.
const SYSTEM_PROMPT = `You are cdp-copilot, a browser copilot with tools to read and automate the current Chrome tab
via the Chrome DevTools Protocol. If asked who or what you are, say you are cdp-copilot, a Chrome extension
copilot — do not claim to be any particular model or vendor, and do not volunteer which model powers you.
Always call take_snapshot before clicking/filling elements you haven't
just seen, since uids only stay valid until the next snapshot. Prefer fill_form over multiple individual
fill calls. If a tool call fails because a uid is stale or an element isn't visible, take a fresh snapshot
and retry rather than guessing.`;

export const MAX_STEPS = 20;

export function buildMessages(history: ModelMessage[], userMessage: string): ModelMessage[] {
  return [...history, { role: 'user', content: userMessage }];
}

export interface AgentStreamOptions {
  toolset?: ToolSet;
  maxSteps?: number;
}

/**
 * The ReAct loop itself, decoupled from settings and tool wiring so tests can
 * drive it with a mock model and mock tools (no browser, no API key).
 */
export async function* streamAgentEvents(
  model: LanguageModel,
  messages: ModelMessage[],
  { toolset = tools, maxSteps = MAX_STEPS }: AgentStreamOptions = {},
): AsyncGenerator<AgentEvent> {
  try {
    const result = streamText({
      model,
      // AI SDK v7 rejects `role: 'system'` entries inside `messages`
      // (allowSystemInMessages defaults to false) — the system prompt has to
      // come through this top-level option instead.
      instructions: SYSTEM_PROMPT,
      messages,
      tools: toolset,
      stopWhen: stepCountIs(maxSteps),
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          yield { type: 'text-delta', text: part.text };
          break;
        case 'tool-call':
          yield { type: 'tool-call', toolCallId: part.toolCallId, name: part.toolName, args: part.input };
          break;
        case 'tool-result':
          yield { type: 'tool-result', toolCallId: part.toolCallId, name: part.toolName, result: part.output };
          break;
        case 'tool-error':
          yield {
            type: 'tool-error',
            toolCallId: part.toolCallId,
            name: part.toolName,
            error: part.error instanceof Error ? part.error.message : String(part.error),
          };
          break;
        case 'error':
          yield { type: 'error', message: part.error instanceof Error ? part.error.message : String(part.error) };
          break;
        default:
          break;
      }
    }

    const [finishReason, steps, usage, responseMessages] = await Promise.all([
      result.finishReason,
      result.steps,
      result.totalUsage,
      result.responseMessages,
    ]);
    yield {
      type: 'done',
      stop: {
        finishReason,
        steps: steps.length,
        hitStepLimit: steps.length >= maxSteps,
        totalTokens: usage?.totalTokens,
      },
      // Drop screenshot payloads before they become next-turn context.
      responseMessages: sanitizeModelMessages(responseMessages) as TurnResponseMessage[],
    };
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/** Production entry point: resolve the configured provider, then run the loop. */
export async function* runAgentTurn(
  settings: Settings,
  history: ModelMessage[],
  userMessage: string,
): AsyncGenerator<AgentEvent> {
  let model: LanguageModel;
  try {
    model = resolveModel(settings);
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
    return;
  }
  yield* streamAgentEvents(model, buildMessages(history, userMessage));
}
