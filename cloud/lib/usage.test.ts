import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { lookupGeneration, readUsage, toMicroUsd } from './usage.ts';

/** Node's built-in runner over native TS — no test framework in this project yet. */

function sse(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/**
 * A stream that dies partway, the way a stopped turn's does.
 *
 * Pull-based on purpose: erroring a controller discards whatever is still
 * queued, so enqueuing everything up front and then erroring would model a
 * stream nobody ever read rather than one that was being drained as it arrived.
 */
function tornStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let next = 0;
  return new ReadableStream({
    pull(controller) {
      if (next < chunks.length) {
        controller.enqueue(encoder.encode(chunks[next++]));
        return;
      }
      controller.error(new Error('aborted'));
    },
  });
}

const USAGE_FRAME =
  'data: {"id":"gen-1","choices":[],"usage":{"prompt_tokens":20000,"completion_tokens":120,"total_tokens":20120,"cost":0.0021,"cost_details":{"upstream_inference_cost":0.002}}}\n\n';

test.afterEach(() => mock.restoreAll());

test('reads the usage frame that closes a stream', async () => {
  const { usage } = await readUsage(
    sse([
      'data: {"id":"gen-1","choices":[{"delta":{"content":"hi"}}]}\n\n',
      USAGE_FRAME,
      'data: [DONE]\n\n',
    ]),
  );
  assert.equal(usage?.prompt_tokens, 20000);
  assert.equal(usage?.total_tokens, 20120);
});

test('survives a usage frame split across chunk boundaries', async () => {
  // Chunk boundaries fall wherever the network puts them, so the parser must
  // buffer partial lines rather than parse per chunk.
  const split = Math.floor(USAGE_FRAME.length / 2);
  const { usage } = await readUsage(
    sse(['data: {"choices":[{"delta":{}}]}\n\n', USAGE_FRAME.slice(0, split), USAGE_FRAME.slice(split)]),
  );
  assert.equal(usage?.total_tokens, 20120);
});

test('reports null when no usage frame ever arrives', async () => {
  // The case that would silently make every hosted call free — worth an alarm
  // rather than a zero.
  const { usage } = await readUsage(
    sse(['data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', 'data: [DONE]\n\n']),
  );
  assert.equal(usage, null);
});

test('ignores the null usage field on ordinary delta frames', async () => {
  const { usage } = await readUsage(
    sse(['data: {"choices":[{"delta":{"content":"hi"}}],"usage":null}\n\n', USAGE_FRAME]),
  );
  assert.equal(usage?.total_tokens, 20120);
});

test('keeps cached-token detail, which is priced separately', async () => {
  const { usage } = await readUsage(
    sse([
      'data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105,"prompt_tokens_details":{"cached_tokens":80}}}\n\n',
    ]),
  );
  assert.equal(usage?.prompt_tokens_details?.cached_tokens, 80);
});

test('carries the router-reported cost, which the ledger bills from', async () => {
  const { usage } = await readUsage(sse([USAGE_FRAME]));
  assert.equal(usage?.cost, 0.0021);
  assert.equal(usage?.cost_details?.upstream_inference_cost, 0.002);
  assert.equal(toMicroUsd(usage), 2100);
});

test('reports the generation id from the first frame that carries one', async () => {
  const { generationId } = await readUsage(
    sse(['data: {"id":"gen-abc","choices":[{"delta":{"content":"hi"}}]}\n\n', 'data: [DONE]\n\n']),
  );
  assert.equal(generationId, 'gen-abc');
});

test('keeps the generation id when the stream is torn down mid-flight', async () => {
  // The stop button. No usage frame will ever arrive, but the tokens generated
  // so far were charged to us, so the id is the only thing standing between a
  // stopped turn and a free one.
  const { usage, generationId } = await readUsage(
    tornStream(['data: {"id":"gen-torn","choices":[{"delta":{"content":"par"}}]}\n\n']),
  );
  assert.equal(usage, null);
  assert.equal(generationId, 'gen-torn');
});

test('toMicroUsd rounds to an integer rather than accumulating float drift', () => {
  // Sub-cent charges are the norm, and hundreds of thousands of them summed as
  // floats would drift; the ledger stores integers.
  assert.equal(toMicroUsd({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0.0000015 }), 2);
  assert.equal(toMicroUsd({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0 }), 0);
});

test('toMicroUsd reports null when cost is absent, never zero', () => {
  // Zero is a real, billable outcome (a cached or free-tier call). "We were not
  // told" has to stay distinguishable from "it was free", or a router that
  // stops reporting cost would silently make every request free.
  assert.equal(toMicroUsd(null), null);
  assert.equal(toMicroUsd({ prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }), null);
});

/** Records what the lookup asked for and answers with a canned sequence. */
function stubLookup(responses: Response[]): { urls: string[] } {
  const urls: string[] = [];
  let call = 0;
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return responses[Math.min(call++, responses.length - 1)];
  });
  return { urls };
}

function generationResponse(record: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data: record }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('recovers cost for a torn-down stream from the generation record', async () => {
  const { urls } = stubLookup([
    generationResponse({
      total_cost: 0.00041,
      native_tokens_prompt: 4400,
      native_tokens_completion: 90,
      native_tokens_cached: 4352,
    }),
  ]);

  const usage = await lookupGeneration('gen-torn', 'sk-or-test', 'https://openrouter.test/api/v1');

  assert.equal(usage?.cost, 0.00041);
  assert.equal(usage?.prompt_tokens, 4400);
  assert.equal(usage?.total_tokens, 4490);
  assert.equal(usage?.prompt_tokens_details?.cached_tokens, 4352);
  assert.match(urls[0] ?? '', /generation\?id=gen-torn/);
});

test('retries a generation lookup that has not settled yet', async () => {
  // The record is written as the generation settles, so a lookup fired the
  // instant a stream tore down can legitimately arrive first.
  const { urls } = stubLookup([
    new Response('', { status: 404 }),
    generationResponse({ total_cost: 0.0002, tokens_prompt: 100, tokens_completion: 10 }),
  ]);

  const usage = await lookupGeneration('gen-late', 'sk-or-test', 'https://openrouter.test/api/v1', {
    sleep: async () => {},
  });

  assert.equal(usage?.cost, 0.0002);
  assert.equal(urls.length, 2);
});

test('gives up on a generation lookup rather than inventing a cost', async () => {
  // Reporting zero here would be indistinguishable from a free request and
  // would serve tokens for nothing; null is what the caller must see.
  stubLookup([new Response('', { status: 404 })]);

  const usage = await lookupGeneration('gen-gone', 'sk-or-test', 'https://openrouter.test/api/v1', {
    sleep: async () => {},
  });

  assert.equal(usage, null);
});
