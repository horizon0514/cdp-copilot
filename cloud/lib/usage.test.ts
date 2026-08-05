import assert from 'node:assert/strict';
import test from 'node:test';
import { readUsage, toMicroUsd } from './usage.ts';

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

const USAGE_FRAME =
  'data: {"id":"1","choices":[],"usage":{"prompt_tokens":20000,"completion_tokens":120,"total_tokens":20120,"cost":0.0021,"cost_details":{"upstream_inference_cost":0.002}}}\n\n';

test('reads the usage frame that closes a stream', async () => {
  const usage = await readUsage(
    sse([
      'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}\n\n',
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
  const usage = await readUsage(
    sse(['data: {"choices":[{"delta":{}}]}\n\n', USAGE_FRAME.slice(0, split), USAGE_FRAME.slice(split)]),
  );
  assert.equal(usage?.total_tokens, 20120);
});

test('reports null when no usage frame ever arrives', async () => {
  // The case that would silently make every hosted call free — worth an alarm
  // rather than a zero.
  const usage = await readUsage(
    sse(['data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', 'data: [DONE]\n\n']),
  );
  assert.equal(usage, null);
});

test('ignores the null usage field on ordinary delta frames', async () => {
  const usage = await readUsage(
    sse(['data: {"choices":[{"delta":{"content":"hi"}}],"usage":null}\n\n', USAGE_FRAME]),
  );
  assert.equal(usage?.total_tokens, 20120);
});

test('keeps cached-token detail, which is priced separately', async () => {
  const usage = await readUsage(
    sse([
      'data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105,"prompt_tokens_details":{"cached_tokens":80}}}\n\n',
    ]),
  );
  assert.equal(usage?.prompt_tokens_details?.cached_tokens, 80);
});

test('carries the router-reported cost, which the ledger bills from', async () => {
  const usage = await readUsage(sse([USAGE_FRAME]));
  assert.equal(usage?.cost, 0.0021);
  assert.equal(usage?.cost_details?.upstream_inference_cost, 0.002);
  assert.equal(toMicroUsd(usage), 2100);
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
