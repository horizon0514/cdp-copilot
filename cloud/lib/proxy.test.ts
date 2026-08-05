import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { proxyChatCompletion, type ProxyDeps } from './proxy.ts';

process.env.OPENROUTER_API_KEY = 'sk-or-test';

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** Stands in for OpenRouter and records exactly what we sent it. */
function captureUpstream(respond: () => Response): { calls: Captured[] } {
  const calls: Captured[] = [];
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return respond();
  });
  return { calls };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function post(body: unknown): Request {
  return new Request('https://pagehand.test/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deps(overrides: Partial<ProxyDeps> = {}): ProxyDeps {
  return {
    userId: 'user-1',
    keepAlive: () => {},
    onUsage: () => {},
    ...overrides,
  };
}

test.afterEach(() => mock.restoreAll());

test('sends the router key as a bearer token', async () => {
  // The whole proxy exists so this key never reaches the extension; if it also
  // failed to reach the router, every request would 401 and look like a config
  // problem rather than a bug.
  const { calls } = captureUpstream(() => jsonResponse({ usage: { cost: 0.001 } }));
  await proxyChatCompletion(post({ model: 'openai/gpt-4.1-mini', messages: [] }), deps());

  assert.equal(calls[0]?.headers.get('authorization'), 'Bearer sk-or-test');
  assert.equal(calls[0]?.url, 'https://openrouter.ai/api/v1/chat/completions');
});

test('attributes the call to the app and the user', async () => {
  const { calls } = captureUpstream(() => jsonResponse({}));
  await proxyChatCompletion(
    post({ model: 'openai/gpt-4.1-mini', messages: [] }),
    deps({ userId: 'user-42' }),
  );

  assert.equal(calls[0]?.headers.get('x-title'), 'Pagehand');
  assert.equal(calls[0]?.headers.get('http-referer'), 'https://pagehand.vercel.app');
  assert.equal(calls[0]?.body.user, 'user-42');
});

test('never forwards a client-supplied user id', async () => {
  // Attribution is what per-user spend forensics rests on, so it is set by the
  // server from the session, never accepted from the caller.
  const { calls } = captureUpstream(() => jsonResponse({}));
  await proxyChatCompletion(
    post({ model: 'openai/gpt-4.1-mini', messages: [], user: 'someone-else' }),
    deps({ userId: 'user-1' }),
  );

  assert.equal(calls[0]?.body.user, 'user-1');
});

test('forces usage reporting on streamed requests', async () => {
  const { calls } = captureUpstream(
    () => new Response('data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  );
  await proxyChatCompletion(post({ model: 'openai/gpt-4.1-mini', messages: [], stream: true }), deps());

  assert.deepEqual(calls[0]?.body.stream_options, { include_usage: true });
});

test('clamps an oversized completion request', async () => {
  // One call asking for a million output tokens should not be able to spend a
  // month of allowance.
  const { calls } = captureUpstream(() => jsonResponse({}));
  await proxyChatCompletion(
    post({ model: 'openai/gpt-4.1-mini', messages: [], max_tokens: 1_000_000 }),
    deps(),
  );

  assert.equal(calls[0]?.body.max_tokens, 16_000);
});

test('rejects a model outside the allowlist before calling the router', async () => {
  const { calls } = captureUpstream(() => jsonResponse({}));
  const res = await proxyChatCompletion(post({ model: 'evil/expensive', messages: [] }), deps());

  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test('reports the cost of a non-streamed call', async () => {
  const seen: (number | undefined)[] = [];
  captureUpstream(() => jsonResponse({ usage: { total_tokens: 12, cost: 0.0031 } }));
  await proxyChatCompletion(
    post({ model: 'openai/gpt-4.1-mini', messages: [] }),
    deps({ onUsage: (usage) => seen.push(usage?.cost) }),
  );

  assert.deepEqual(seen, [0.0031]);
});

test('passes a router error through with its status and body', async () => {
  // The router's own message is far more useful in the panel than anything we
  // would invent — a 402 from them has to stay a 402 here.
  captureUpstream(
    () =>
      new Response(JSON.stringify({ error: { message: 'Insufficient credits' } }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
  );
  const res = await proxyChatCompletion(post({ model: 'openai/gpt-4.1-mini', messages: [] }), deps());

  assert.equal(res.status, 402);
  assert.match(await res.text(), /Insufficient credits/);
});
