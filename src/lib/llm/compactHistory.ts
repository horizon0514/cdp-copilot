import type { ModelMessage } from 'ai';

/**
 * Drop the oldest turn history when it grows too large, keeping only a recent
 * tail. This is normally where an LLM summarization pass would go — but the
 * task ledger already holds the goal, plan, findings and notes, and its digest
 * is re-injected into the instructions every step, so the trimmed steps'
 * durable value is already preserved. That makes compaction a free, synchronous
 * truncation instead of an extra model call.
 *
 * Sizes are measured in characters (~4 per token) rather than real tokens: an
 * exact count would need the provider's tokenizer, and a conservative char
 * budget is enough to keep a long run inside a typical context window.
 */

/** Compact once the whole history passes this — ~45K tokens, safe under 64K. */
export const COMPACT_TRIGGER_CHARS = 180_000;
/** Target size of the kept tail — ~25K tokens, leaving room for the reply. */
export const COMPACT_KEEP_CHARS = 100_000;

const TRIM_NOTE =
  '[Earlier steps of this task were trimmed to save context. Your task ledger below is the source of ' +
  'truth for the goal, plan, findings, and notes — rely on it rather than the trimmed history.]';

function sizeOf(value: unknown): number {
  return JSON.stringify(value)?.length ?? 0;
}

export interface CompactOptions {
  triggerChars?: number;
  keepChars?: number;
}

/**
 * Providers require the first message to be a user turn and every tool-call to
 * be answered, so trimming can't just slice: it keeps the original request
 * (messages[0], where the task was stated) as the anchor, appends a trim note
 * to it, then attaches a recent tail that starts on a clean boundary (no
 * leading tool result whose call was trimmed away).
 */
export function compactHistory<T extends ModelMessage>(
  messages: T[],
  { triggerChars = COMPACT_TRIGGER_CHARS, keepChars = COMPACT_KEEP_CHARS }: CompactOptions = {},
): T[] {
  // Need at least [request, …, something to trim] for this to be worth it.
  if (messages.length <= 3) return messages;
  if (sizeOf(messages) <= triggerChars) return messages;

  // Walk back from the end, keeping messages until the tail fills the budget.
  // Index 0 is the original request and is kept separately as the anchor.
  let acc = 0;
  let start = messages.length;
  for (let i = messages.length - 1; i >= 1; i--) {
    acc += sizeOf(messages[i]);
    if (acc > keepChars && start < messages.length) break;
    start = i;
  }

  // A tool message at the boundary is an orphaned result — its tool-call is
  // being trimmed. Drop leading tool (and bare assistant tool-call) messages so
  // the tail opens cleanly.
  let tail = messages.slice(start);
  while (tail.length > 0 && tail[0].role === 'tool') {
    tail = tail.slice(1);
  }

  // Everything still fits after boundary cleanup — nothing meaningful to trim.
  if (start <= 1 || tail.length === 0 || tail.length >= messages.length - 1) {
    return messages;
  }

  const head = messages[0];
  const anchor: T =
    head.role === 'user' && typeof head.content === 'string'
      ? ({ ...head, content: `${head.content}\n\n${TRIM_NOTE}` } as T)
      : head;

  return [anchor, ...tail];
}
