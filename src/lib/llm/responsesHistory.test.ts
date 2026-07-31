import { describe, it, expect } from 'vitest';
import { streamText, type ModelMessage } from 'ai';
import { resolveModel } from './providers';
import type { Settings } from '../storage/schema';

/**
 * A two-turn history where the assistant answer carries the `itemId` the
 * Responses API handed back on turn 1 — the exact shape that comes back out of
 * a persisted thread.
 */
const HISTORY: ModelMessage[] = [
  { role: 'user', content: 'What is the title of this page?' },
  {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'The title is "Example Domain".',
        providerOptions: { openai: { itemId: 'msg_abc123' } },
      },
    ],
  },
  { role: 'user', content: 'And what is the first heading?' },
];

/** Minimal Responses SSE stream — enough for streamText to finish cleanly. */
function fakeResponsesStream(): Response {
  const events = [
    { type: 'response.created', response: { id: 'resp_1' } },
    { type: 'response.output_text.delta', delta: 'ok', item_id: 'msg_2' },
    {
      type: 'response.completed',
      response: {
        id: 'resp_1',
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [],
      },
    },
  ];
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function capturedRequestBody(settings: Settings): Promise<Record<string, unknown>> {
  let captured: Record<string, unknown> | undefined;
  const fetchSpy: typeof fetch = async (_input, init) => {
    captured = JSON.parse(String(init?.body));
    return fakeResponsesStream();
  };

  const original = globalThis.fetch;
  globalThis.fetch = fetchSpy;
  try {
    const result = streamText({ model: resolveModel(settings), messages: HISTORY });
    // Drain so the request is actually issued.
    for await (const _ of result.textStream) void _;
  } finally {
    globalThis.fetch = original;
  }

  if (!captured) throw new Error('no request was captured');
  return captured;
}

describe('openai provider — Responses history', () => {
  it('sends the previous answer inline rather than an item_reference', async () => {
    const body = await capturedRequestBody({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      baseURL: 'https://api.deepseek.com',
    });

    // store:true would turn the assistant turn into a bare pointer that only
    // OpenAI's own servers can dereference, silently erasing the answer.
    expect(body.store).toBe(false);

    const input = body.input as { type?: string; role?: string; content?: unknown }[];
    expect(input.some((item) => item.type === 'item_reference')).toBe(false);

    const assistant = input.find((item) => item.role === 'assistant');
    expect(assistant?.content).toEqual([
      { type: 'output_text', text: 'The title is "Example Domain".' },
    ]);
  });

  it('targets /responses under a custom base URL', async () => {
    let url = '';
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      url = String(input);
      void init;
      return fakeResponsesStream();
    };
    try {
      const result = streamText({
        model: resolveModel({
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4.1',
          baseURL: 'https://api.deepseek.com',
        }),
        messages: HISTORY,
      });
      for await (const _ of result.textStream) void _;
    } finally {
      globalThis.fetch = original;
    }

    expect(url).toBe('https://api.deepseek.com/responses');
  });
});
