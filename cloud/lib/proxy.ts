/**
 * The hosted model proxy.
 *
 * Deliberately a plain `(Request) => Promise<Response>` with its dependencies
 * injected: a Next route handler already has this signature, so if the Vercel
 * Hobby 60s ceiling ever forces a move to another runtime, this file moves
 * unchanged. Nothing in here may import from `next/*`.
 *
 * What it is *not*: an agent. The loop, the tools, and `chrome.debugger` all
 * stay in the side panel — this proxies one model step at a time, up to a
 * hundred times per turn. Per-request overhead is therefore the design budget.
 */
import {
  APP_TITLE,
  APP_URL,
  MAX_REQUEST_BYTES,
  ROUTER_BASE_URL,
  allowedModels,
  routerApiKey,
} from './config.ts';
import { lookupGeneration, readUsage, type TokenUsage } from './usage.ts';

/** Guards against a client asking for a completion large enough to blow through
 * a period's budget in one call. */
const MAX_COMPLETION_TOKENS = 16_000;

/**
 * How the cost was learned.
 *
 * `missing` is the only one that means unbilled tokens, so it is worth
 * distinguishing from a recovered cost rather than folding both into a null.
 */
export type UsageSource = 'stream' | 'lookup' | 'missing';

export interface UsageMeta {
  userId: string;
  model: string;
  source: UsageSource;
  /** The router's handle on this request; the only way to re-ask what it cost. */
  generationId: string | null;
}

export interface ProxyDeps {
  userId: string;
  /** Keeps the runtime alive for work that outlives the response body. */
  keepAlive: (work: Promise<unknown>) => void;
  /** Where the ledger will hook in; Phase 1a only logs. */
  onUsage: (usage: TokenUsage | null, meta: UsageMeta) => void;
}

interface ChatCompletionRequest {
  model?: unknown;
  stream?: unknown;
  max_tokens?: unknown;
  max_completion_tokens?: unknown;
  stream_options?: Record<string, unknown>;
  cache_control?: unknown;
  user?: unknown;
  [key: string]: unknown;
}

/**
 * Turns prompt caching on for the one family that does not do it by itself.
 *
 * DeepSeek and OpenAI cache automatically; Anthropic does not — it caches only
 * up to an explicit breakpoint, so a Claude model served without one pays full
 * price for the entire resent history on every step. At ~100 steps per turn
 * that is the difference between a viable Pro tier and an unaffordable one, and
 * it fails silently: the requests all succeed, they just cost ten times more.
 *
 * The router's request-root form is the right one here. It applies the
 * breakpoint to the last cacheable block and advances it as the conversation
 * grows, which is exactly the shape of an agent loop — whereas the per-block
 * form would need the extension to place breakpoints it cannot see the
 * consequences of, and caps out at four.
 *
 * Gated on the model prefix rather than sent unconditionally: it is an
 * Anthropic concept, and an unrecognised root field is a 400 waiting to happen
 * on some other provider.
 */
function needsCacheBreakpoint(model: string): boolean {
  return model.startsWith('anthropic/');
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { message, type: 'invalid_request_error', code } }, { status });
}

export async function proxyChatCompletion(request: Request, deps: ProxyDeps): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_REQUEST_BYTES) {
    return errorResponse(413, 'request_too_large', 'Request body exceeds the size limit.');
  }

  const raw = await request.text();
  // content-length is a claim; the body is the fact.
  if (raw.length > MAX_REQUEST_BYTES) {
    return errorResponse(413, 'request_too_large', 'Request body exceeds the size limit.');
  }

  let body: ChatCompletionRequest;
  try {
    body = JSON.parse(raw) as ChatCompletionRequest;
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body is not valid JSON.');
  }

  const model = typeof body.model === 'string' ? body.model : '';
  const allowed = allowedModels();
  if (!allowed.has(model)) {
    // Named in the log too: the client sees this as a 403 somewhere inside a
    // turn, and "which model did it actually ask for" is the only question
    // worth answering at that point.
    console.warn(`[reject] model_not_allowed ${JSON.stringify(model)} user=${deps.userId}`);
    // A plan gate, not a pricing one: without it a Free user could route every
    // step of every turn through the most expensive model on the catalogue.
    //
    // Names both sides: a bare 403 in the panel gives no hint whether the model
    // is misspelled, absent from the catalogue, or simply above the caller's
    // plan, and the allowlist lives in an env var the caller cannot see.
    return errorResponse(
      403,
      'model_not_allowed',
      `Model "${model}" is not available on this plan. Allowed: ${[...allowed].join(', ')}.`,
    );
  }

  const streaming = body.stream === true;
  const upstreamBody: ChatCompletionRequest = {
    ...body,
    // Per-user attribution for spend forensics on the router's dashboard.
    user: deps.userId,
    ...(streaming
      ? {
          // Redundant against OpenRouter, which reports usage unconditionally —
          // kept because it states the requirement we place on any upstream, and
          // costs one field to keep true for the next one.
          stream_options: { ...(body.stream_options ?? {}), include_usage: true },
        }
      : {}),
    // Set here rather than in the extension so it cannot be forgotten the day a
    // Claude model joins the allowlist — the proxy knows the model name, and
    // this is the only place that has to.
    ...(needsCacheBreakpoint(model) && body.cache_control === undefined
      ? { cache_control: { type: 'ephemeral' } }
      : {}),
  };
  if (typeof body.max_tokens === 'number') {
    upstreamBody.max_tokens = Math.min(body.max_tokens, MAX_COMPLETION_TOKENS);
  }
  if (typeof body.max_completion_tokens === 'number') {
    upstreamBody.max_completion_tokens = Math.min(body.max_completion_tokens, MAX_COMPLETION_TOKENS);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${routerApiKey()}`,
        // App-level attribution on the router's dashboard.
        'http-referer': APP_URL,
        'x-title': APP_TITLE,
      },
      body: JSON.stringify(upstreamBody),
      signal: request.signal,
    });
  } catch (err) {
    return errorResponse(
      502,
      'upstream_unreachable',
      err instanceof Error ? err.message : 'Router request failed.',
    );
  }

  if (!upstream.ok || !upstream.body) {
    // Pass the router's own error through — the SDK surfaces its message in the
    // panel, which is far more useful than anything we'd invent.
    const detail = await upstream.text();
    return new Response(detail, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  }

  if (!streaming) {
    const text = await upstream.text();
    let usage: TokenUsage | null = null;
    let generationId: string | null = null;
    try {
      const parsed = JSON.parse(text) as { usage?: TokenUsage; id?: unknown };
      usage = parsed.usage ?? null;
      generationId = typeof parsed.id === 'string' ? parsed.id : null;
    } catch {
      // Unparseable body: nothing to bill from and no handle to recover with.
    }
    deps.onUsage(usage, {
      userId: deps.userId,
      model,
      source: usage ? 'stream' : 'missing',
      generationId,
    });
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  }

  const [toClient, toLedger] = upstream.body.tee();

  // Start draining immediately rather than after the response completes: an
  // unread tee branch makes the tee buffer the whole response in memory.
  const accounting = settleUsage(toLedger, deps, model);
  deps.keepAlive(accounting);

  return new Response(toClient, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

/**
 * Establishes what a streamed request cost, by whatever route works.
 *
 * The happy path is the usage frame that closes the stream. The path that
 * matters is the other one: a turn is up to a hundred steps behind a stop
 * button, so a step whose stream is torn down mid-flight is routine, not
 * exceptional — and the router still charges us for what was generated before
 * the tear-down. Without the lookup, "press stop" is a working way to use the
 * hosted model for free, and it is not a subtle one to find.
 *
 * The lookup deliberately outlives the client: it runs inside `keepAlive`, and
 * `lookupGeneration` uses a fetch with no abort signal attached.
 */
async function settleUsage(
  toLedger: ReadableStream<Uint8Array>,
  deps: ProxyDeps,
  model: string,
): Promise<void> {
  const { usage, generationId } = await readUsage(toLedger);
  if (usage) {
    deps.onUsage(usage, { userId: deps.userId, model, source: 'stream', generationId });
    return;
  }

  const recovered = generationId
    ? await lookupGeneration(generationId, routerApiKey(), ROUTER_BASE_URL)
    : null;
  deps.onUsage(recovered, {
    userId: deps.userId,
    model,
    source: recovered ? 'lookup' : 'missing',
    generationId,
  });
}
