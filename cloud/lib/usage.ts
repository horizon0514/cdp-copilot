/**
 * Pulling usage — and the cost — back out of a streamed completion.
 *
 * Usage arrives in exactly one place: a final SSE frame whose `choices` array is
 * empty and whose `usage` is populated. OpenRouter sends it unconditionally; the
 * proxy still forces `stream_options.include_usage` because that is the
 * requirement we place on any upstream, and this one merely happens to satisfy
 * it already.
 *
 * `cost` is the reason the ledger has no price table: the router states what it
 * charged us, so we record that instead of recomputing it from prices that could
 * silently go stale (PLAN-subscription §2).
 */

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** Present on providers that report cache hits; priced differently. */
  prompt_tokens_details?: { cached_tokens?: number };
  /** USD charged to our account for this request. The ledger's source of truth. */
  cost?: number;
  cost_details?: {
    /** What the provider charged, before the router's own accounting. */
    upstream_inference_cost?: number;
  };
}

/** Cost as an integer so the ledger never accumulates float drift across
 * hundreds of thousands of sub-cent requests. */
export function toMicroUsd(usage: TokenUsage | null): number | null {
  if (usage?.cost === undefined) return null;
  return Math.round(usage.cost * 1_000_000);
}

interface UsageCarrier {
  usage?: TokenUsage | null;
}

/** Cheap gate before JSON.parse — this runs over every frame of every stream,
 * and on a metered-CPU runtime that cost is the whole budget. */
function mightCarryUsage(line: string): boolean {
  return line.startsWith('data:') && line.includes('"usage":{');
}

function usageFromLine(line: string): TokenUsage | null {
  if (!mightCarryUsage(line)) return null;
  const payload = line.slice(line.indexOf(':') + 1).trim();
  if (payload === '[DONE]') return null;
  try {
    const frame = JSON.parse(payload) as UsageCarrier;
    return frame.usage ?? null;
  } catch {
    // A frame split across chunk boundaries lands here; the line-buffering in
    // readUsage means we see it again intact.
    return null;
  }
}

/**
 * Drains an SSE stream and returns the last usage frame it saw.
 *
 * Must consume the stream to completion: this runs on one branch of a `tee()`,
 * and an unread branch makes the tee buffer the entire response in memory while
 * the client waits.
 */
export async function readUsage(stream: ReadableStream<Uint8Array>): Promise<TokenUsage | null> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: TokenUsage | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      // The trailing fragment may be a partial frame — hold it for the next read.
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const found = usageFromLine(line);
        if (found) usage = found;
      }
    }
    const tail = usageFromLine(buffer);
    if (tail) usage = tail;
  } finally {
    reader.releaseLock();
  }

  return usage;
}
