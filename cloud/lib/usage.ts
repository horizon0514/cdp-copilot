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
 *
 * The final frame is not guaranteed to arrive. A turn runs up to a hundred steps
 * behind a stop button, and a stopped step tears the stream down mid-flight — no
 * usage frame, but the tokens generated up to that point were still charged to
 * us (providers that support stream cancellation bill the partial completion;
 * those that don't keep generating and bill the whole thing). That is why every
 * stream also yields its generation id: it is the only handle left for asking
 * the router after the fact what a torn-down request actually cost.
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
  id?: unknown;
}

/** What a drained stream tells us about what it cost. */
export interface StreamAccounting {
  usage: TokenUsage | null;
  /** The router's generation id, for recovering cost when `usage` is null. */
  generationId: string | null;
}

/** Cheap gate before JSON.parse — this runs over every frame of every stream,
 * and on a metered-CPU runtime that cost is the whole budget. */
function mightCarryUsage(line: string): boolean {
  return line.startsWith('data:') && line.includes('"usage":{');
}

function framePayload(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(line.indexOf(':') + 1).trim();
  return payload === '[DONE]' || payload === '' ? null : payload;
}

function usageFromLine(line: string): TokenUsage | null {
  if (!mightCarryUsage(line)) return null;
  const payload = framePayload(line);
  if (payload === null) return null;
  try {
    const frame = JSON.parse(payload) as UsageCarrier;
    return frame.usage ?? null;
  } catch {
    // A frame split across chunk boundaries lands here; the line-buffering in
    // readUsage means we see it again intact.
    return null;
  }
}

function idFromLine(line: string): string | null {
  // Same shape of cheap gate as mightCarryUsage, for the same reason.
  if (!line.startsWith('data:') || !line.includes('"id":')) return null;
  const payload = framePayload(line);
  if (payload === null) return null;
  try {
    const frame = JSON.parse(payload) as UsageCarrier;
    return typeof frame.id === 'string' && frame.id !== '' ? frame.id : null;
  } catch {
    return null;
  }
}

/**
 * Drains an SSE stream, returning the last usage frame it saw and the generation
 * id it was carrying.
 *
 * Must consume the stream to completion: this runs on one branch of a `tee()`,
 * and an unread branch makes the tee buffer the entire response in memory while
 * the client waits.
 *
 * A torn-down stream (the user pressed stop) makes the read throw. That is the
 * case the generation id exists for, so the id gathered so far is returned
 * rather than lost with the exception.
 */
export async function readUsage(stream: ReadableStream<Uint8Array>): Promise<StreamAccounting> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: TokenUsage | null = null;
  let generationId: string | null = null;

  const scan = (line: string) => {
    const found = usageFromLine(line);
    if (found) usage = found;
    // The id is the same on every frame of a generation, so stop looking once
    // it is known — this runs per line, per step, per turn.
    if (generationId === null) generationId = idFromLine(line);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      // The trailing fragment may be a partial frame — hold it for the next read.
      buffer = lines.pop() ?? '';
      for (const line of lines) scan(line);
    }
    scan(buffer);
  } catch {
    // An aborted upstream rejects the pending read. Everything scanned before
    // that point still stands, and the id is the whole reason we care.
  } finally {
    reader.releaseLock();
  }

  return { usage, generationId };
}

/** Shape of `GET /generation`; the router wraps the record in `data`. */
interface GenerationRecord {
  total_cost?: number;
  tokens_prompt?: number;
  tokens_completion?: number;
  native_tokens_prompt?: number;
  native_tokens_completion?: number;
  native_tokens_cached?: number;
}

function usageFromGeneration(record: GenerationRecord): TokenUsage | null {
  if (typeof record.total_cost !== 'number') return null;
  const prompt = record.native_tokens_prompt ?? record.tokens_prompt ?? 0;
  const completion = record.native_tokens_completion ?? record.tokens_completion ?? 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
    ...(typeof record.native_tokens_cached === 'number'
      ? { prompt_tokens_details: { cached_tokens: record.native_tokens_cached } }
      : {}),
    cost: record.total_cost,
  };
}

export interface LookupOptions {
  attempts?: number;
  /** Injected in tests; production waits for real. */
  sleep?: (ms: number) => Promise<void>;
}

const LOOKUP_ATTEMPTS = 3;
const LOOKUP_BACKOFF_MS: readonly number[] = [300, 900];
const LAST_BACKOFF_MS = 900;

/**
 * Asks the router what a generation cost, for the streams that ended without
 * saying so.
 *
 * Deliberately never passes the caller's abort signal: this exists precisely
 * because the caller went away, so a fetch tied to their signal would be dead on
 * arrival. It also retries — the record is written as the generation settles,
 * so a lookup fired the instant a stream tore down can arrive first and 404.
 */
export async function lookupGeneration(
  generationId: string,
  apiKey: string,
  baseUrl: string,
  { attempts = LOOKUP_ATTEMPTS, sleep = defaultSleep }: LookupOptions = {},
): Promise<TokenUsage | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await sleep(LOOKUP_BACKOFF_MS[attempt - 1] ?? LAST_BACKOFF_MS);
    }
    try {
      const response = await fetch(
        `${baseUrl}/generation?id=${encodeURIComponent(generationId)}`,
        { headers: { authorization: `Bearer ${apiKey}` } },
      );
      if (response.status === 404) continue; // Not settled yet.
      if (!response.ok) return null;
      const body = (await response.json()) as { data?: GenerationRecord } & GenerationRecord;
      const usage = usageFromGeneration(body.data ?? body);
      if (usage) return usage;
    } catch {
      // Network failure on the recovery path; the next attempt may do better.
    }
  }
  return null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
