import type { ModelMessage } from 'ai';

/**
 * Where per-step volatile state rides in the prompt.
 *
 * The ledger digest and the reflection note both change between steps — that is
 * their whole purpose. They used to be appended to `instructions`, which put
 * them at the very front of the prompt, and every provider's prompt cache is a
 * *prefix* cache: change byte one and nothing after it can be reused. A turn is
 * up to a hundred steps that each resend the whole history, so a digest that
 * updates when the model saves a finding was taking the cache hit rate to zero
 * for the step after every ledger write. Measured: a step with 4,436 prompt
 * tokens and 64 cached cost 407 µUSD, against 99 µUSD for a near-identical step
 * with 4,352 cached — four times the price for the same work.
 *
 * So the volatile part moves to the *end* of the messages instead. The note from
 * the previous step is stripped before the new one is appended, which still
 * breaks the cached prefix — but at the tail, where the last step's assistant
 * and tool messages are new and uncacheable anyway, rather than at the head.
 *
 * It rides as a `user` message because that is the only role providers accept
 * after a tool result without breaking their alternation rules, and because
 * recency helps: the model reads it as the latest word on the task, not as
 * boilerplate it saw at the top a hundred steps ago.
 */

/** Identifies our injected message so the next step can strip it back out. */
export const LIVE_NOTE_MARKER = '[live task state — regenerated every step]';

export function liveNoteMessage(body: string): ModelMessage {
  return { role: 'user', content: `${LIVE_NOTE_MARKER}\n${body}` };
}

export function isLiveNote(message: ModelMessage): boolean {
  return (
    message.role === 'user' &&
    typeof message.content === 'string' &&
    message.content.startsWith(LIVE_NOTE_MARKER)
  );
}

/**
 * Drop every live note from a history.
 *
 * `prepareStep`'s `messages` override carries forward, so last step's note is
 * sitting in this step's input. Without this the notes would pile up and the
 * model would read a stale digest as if it were current.
 */
export function stripLiveNotes<T extends ModelMessage>(messages: T[]): T[] {
  return messages.some(isLiveNote) ? messages.filter((message) => !isLiveNote(message)) : messages;
}

/**
 * Build this step's note, or null when there is nothing volatile to say.
 *
 * Nothing to say is the common case early in a turn, and returning null there
 * keeps those steps' histories pure appends — the best cache behaviour available.
 */
export function composeLiveNote(parts: (string | null | undefined)[]): ModelMessage | null {
  const body = parts.filter((part): part is string => Boolean(part)).join('\n\n');
  return body ? liveNoteMessage(body) : null;
}
