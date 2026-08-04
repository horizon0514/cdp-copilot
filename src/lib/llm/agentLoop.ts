import {
  streamText,
  stepCountIs,
  hasToolCall,
  type ModelMessage,
  type LanguageModel,
  type ToolSet,
  type AssistantModelMessage,
  type ToolModelMessage,
} from 'ai';
import { tools, TASK_COMPLETE_TOOL } from '../tools';
import { resolveModel } from './providers';
import { Settings } from '../storage/schema';
import { dropDanglingToolCalls, elideStaleSnapshots, sanitizeModelMessages } from './sanitizeMessages';
import { compactHistory } from './compactHistory';
import { reflectionNote } from './reflection';
import { getActiveLedger } from '../ledger/activeLedger';
import { formatLedgerDigest } from '../ledger/digest';

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
const SYSTEM_PROMPT = `You are Pagehand, a browser copilot with tools to read and automate the current Chrome tab
via the Chrome DevTools Protocol. If asked who or what you are, say you are Pagehand, a Chrome extension
copilot — do not claim to be any particular model or vendor, and do not volunteer which model powers you.
Always call take_snapshot before clicking/filling elements you haven't
just seen, since uids only stay valid until the next snapshot. Prefer fill_form over multiple individual
fill calls. If a tool call fails because a uid is stale or an element isn't visible, take a fresh snapshot
and retry rather than guessing.

To READ a page — comments, listings, tables, search results, anything you collect rather than click —
use extract_content, not take_snapshot: it reads the whole visible page in one call and returns only
compact JSON, so it costs a tiny fraction of a snapshot. For feeds and comment sections that load on
scroll, alternate: scroll with evaluate_script (e.g. "() => window.scrollBy(0, window.innerHeight * 3)"),
wait_for or a short pause for content to load, then extract_content again — each round reads everything
newly rendered at once. Reserve take_snapshot for when you need uids to interact with elements.

For multi-step tasks you have a durable task ledger that survives even when older messages are trimmed
from this conversation. Start such tasks by calling update_plan with the goal (including the success
criterion) and a short step plan, and keep statuses current as you go. The moment you discover something
the task asked for, call save_finding — results that exist only in prose are lost when the conversation
is trimmed. Before detours and at the end of each work chunk, call add_note with where you left off.
The current ledger state appears in these instructions each step; treat it — not the conversation — as
the source of truth for progress, and never re-collect a finding already saved. Trivial single-step
requests don't need the ledger.

When the goal is met — measured against the success criterion in your ledger — call task_complete to end
the task; don't keep going to fill steps. If you get stuck, do not repeat the same action hoping for a
different result: change approach, and if a whole strategy is exhausted, say what's blocking you and stop.
To search the web, use the web_search tool rather than navigating to a search engine and reading the page:
it returns clean ranked results. Pass concise keywords, not the raw question, and if results are poor,
reformulate with different terms rather than retrying the same query. Then navigate_page to a promising
result and extract_content to read it.`;

/**
 * A hard ceiling, not the normal way a turn ends. A healthy turn now stops when
 * the model calls task_complete (see stopWhen below); this is the runaway
 * guard. It can be this high because compactHistory keeps a long run inside the
 * context window and reflection steers the model off dead ends — neither of
 * which existed when this was 40, the point at which long collection tasks used
 * to get cut off mid-work.
 */
export const MAX_STEPS = 100;

export function buildMessages(history: ModelMessage[], userMessage: string): ModelMessage[] {
  return [...history, { role: 'user', content: userMessage }];
}

export interface AgentStreamOptions {
  toolset?: ToolSet;
  maxSteps?: number;
  /** Abort the turn mid-flight (the composer's stop button). */
  abortSignal?: AbortSignal;
  /**
   * Called before every step; a non-null return is appended to the system
   * prompt for that step. Production feeds the task-ledger digest through
   * here so durable state reaches the model even after history trimming.
   */
  extraInstructions?: () => string | null;
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
  { toolset = tools, maxSteps = MAX_STEPS, abortSignal, extraInstructions }: AgentStreamOptions = {},
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
      // Two ways to stop: the model declares the goal met, or the runaway guard
      // trips. task_complete is the intended path; the step count is the fuse.
      stopWhen: [stepCountIs(maxSteps), hasToolCall(TASK_COMPLETE_TOOL)],
      abortSignal,
      // Every step resends the whole turn so far. Snapshots are the one result
      // big enough to matter (up to ~12K tokens each) and the one that stops
      // being true — its uids die the moment a newer snapshot exists — so a
      // long turn otherwise carries several stale copies of the same page and
      // exhausts the context window long before the step limit. The override
      // carries forward, so each step elides only what the last one added.
      //
      // Everything that keeps a long turn alive converges here, rebuilt each
      // step. Messages get snapshot elision then context compaction; the
      // instructions get the ledger digest and any reflection note. Both the
      // digest and the reflection ride in the instructions rather than as
      // messages: instructions are rebuilt every step (always current, never
      // duplicated in history) and can't break the strict user/assistant/tool
      // alternation providers enforce.
      prepareStep: ({ messages: stepMessages, stepNumber, responseMessages }) => {
        const trimmed = compactHistory(elideStaleSnapshots(stepMessages));

        const parts = [SYSTEM_PROMPT];
        const digest = extraInstructions?.();
        if (digest) parts.push(digest);
        // Stall detection reads responseMessages, which compaction never
        // touches, so the real action sequence stays visible to it.
        const reflection = reflectionNote(stepNumber, responseMessages);
        if (reflection) parts.push(reflection);

        return {
          messages: trimmed,
          // Always set: the override carries forward, so a step with nothing
          // extra must explicitly fall back to the bare system prompt.
          instructions: parts.join('\n\n'),
        };
      },
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
  yield* streamAgentEvents(model, buildMessages(history, userMessage), {
    abortSignal,
    extraInstructions: () => {
      const ledger = getActiveLedger();
      return ledger ? formatLedgerDigest(ledger) : null;
    },
  });
}
