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
import { dropDanglingToolCalls, elideStaleSnapshots, sanitizeModelMessages } from './sanitizeMessages';

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
  /** The user pressed stop — not a model or provider decision. */
  aborted?: boolean;
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

/**
 * A step is one model round trip plus its tools, and browser work eats them
 * fast: the snapshot→act→snapshot rhythm the system prompt asks for costs two
 * steps per interaction, so a form fill and submit is already a dozen.
 *
 * The ceiling that actually bites first is context, not this number — see the
 * prepareStep elision below, without which a long turn dies of a full context
 * window well before reaching the limit.
 */
export const MAX_STEPS = 40;

export function buildMessages(history: ModelMessage[], userMessage: string): ModelMessage[] {
  return [...history, { role: 'user', content: userMessage }];
}

export interface AgentStreamOptions {
  toolset?: ToolSet;
  maxSteps?: number;
  /** Abort the turn mid-flight (the composer's stop button). */
  abortSignal?: AbortSignal;
}

/**
 * Aborting throws away the in-flight step, so the SDK rejects its result
 * promises when no step ever completed. Fall back instead of letting that
 * surface to the user as a failure — they asked for the stop.
 */
function tolerate<T>(promise: PromiseLike<T>, fallback: T): Promise<T> {
  return Promise.resolve(promise).then(
    (value) => value,
    () => fallback,
  );
}

/**
 * The ReAct loop itself, decoupled from settings and tool wiring so tests can
 * drive it with a mock model and mock tools (no browser, no API key).
 */
export async function* streamAgentEvents(
  model: LanguageModel,
  messages: ModelMessage[],
  { toolset = tools, maxSteps = MAX_STEPS, abortSignal }: AgentStreamOptions = {},
): AsyncGenerator<AgentEvent> {
  const stopped = () => abortSignal?.aborted === true;
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
      abortSignal,
      // Every step resends the whole turn so far. Snapshots are the one result
      // big enough to matter (up to ~12K tokens each) and the one that stops
      // being true — its uids die the moment a newer snapshot exists — so a
      // long turn otherwise carries several stale copies of the same page and
      // exhausts the context window long before the step limit. The override
      // carries forward, so each step elides only what the last one added.
      prepareStep: ({ messages: stepMessages }) => ({
        messages: elideStaleSnapshots(stepMessages),
      }),
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

    if (stopped()) {
      yield await abortedTurn(result, maxSteps);
      return;
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
    // A stop tears down the model request, so the failure it raises is expected.
    if (stopped()) {
      yield {
        type: 'done',
        stop: { finishReason: 'abort', steps: 0, hitStepLimit: false, aborted: true },
        responseMessages: [STOP_NOTE],
      };
      return;
    }
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/** Stands in for the reply the user cut off. Anthropic and OpenAI both expect an
 * assistant turn between two user messages, and this says why there isn't one. */
const STOP_NOTE: AssistantModelMessage = {
  role: 'assistant',
  content: '[Stopped by the user before I finished this turn.]',
};

/**
 * Keep whatever steps finished before the stop so the transcript the model sees
 * next turn matches what the user watched happen — minus any tool call whose
 * result never arrived, which providers reject.
 */
async function abortedTurn(
  result: ReturnType<typeof streamText>,
  maxSteps: number,
): Promise<Extract<AgentEvent, { type: 'done' }>> {
  const [steps, totalTokens, responseMessages] = await Promise.all([
    tolerate(Promise.resolve(result.steps).then((s) => s.length), 0),
    tolerate(Promise.resolve(result.totalUsage).then((u) => u?.totalTokens), undefined),
    tolerate(Promise.resolve(result.responseMessages).then((m) => m as TurnResponseMessage[]), []),
  ]);

  const kept = dropDanglingToolCalls(
    sanitizeModelMessages(responseMessages) as TurnResponseMessage[],
  );

  return {
    type: 'done',
    stop: {
      finishReason: 'abort',
      steps,
      hitStepLimit: steps >= maxSteps,
      totalTokens,
      aborted: true,
    },
    responseMessages: kept.some((m) => m.role === 'assistant') ? kept : [...kept, STOP_NOTE],
  };
}

/** Production entry point: resolve the configured provider, then run the loop. */
export async function* runAgentTurn(
  settings: Settings,
  history: ModelMessage[],
  userMessage: string,
  abortSignal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  let model: LanguageModel;
  try {
    model = resolveModel(settings);
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
    return;
  }
  yield* streamAgentEvents(model, buildMessages(history, userMessage), { abortSignal });
}
