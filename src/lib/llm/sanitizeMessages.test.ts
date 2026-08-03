import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import {
  dropDanglingToolCalls,
  elideStaleSnapshots,
  sanitizeModelMessages,
  sanitizeValue,
} from './sanitizeMessages';

describe('sanitizeModelMessages', () => {
  const png = `data:image/png;base64,${'A'.repeat(200)}`;

  it('strips data-URL images from nested JSON tool results', () => {
    const messages: ModelMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: '1',
            toolName: 'take_screenshot',
            output: { type: 'json', value: { image: png } },
          },
        ],
      },
    ];

    const sanitized = sanitizeModelMessages(messages);
    const part = sanitized[0].content[0];
    expect(part).toMatchObject({
      type: 'tool-result',
      output: {
        type: 'json',
        value: { image: expect.stringContaining('[image omitted') },
      },
    });
    expect(JSON.stringify(sanitized)).not.toContain('data:image');
  });

  it('leaves non-image content alone', () => {
    expect(sanitizeValue({ snapshot: 'button "OK"', n: 2 })).toEqual({
      snapshot: 'button "OK"',
      n: 2,
    });
  });
});

describe('elideStaleSnapshots', () => {
  const snapshot = (id: string, text: string): ModelMessage => ({
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: id,
        toolName: 'take_snapshot',
        output: { type: 'json', value: { url: 'https://example.com/', snapshot: text, uidCount: 2 } },
      },
    ],
  });

  it('keeps the newest snapshot and stubs the ones it superseded', () => {
    const messages: ModelMessage[] = [
      snapshot('1', 'heading Old'),
      { role: 'assistant', content: 'looking again' },
      snapshot('2', 'heading Current'),
    ];

    const [first, , last] = elideStaleSnapshots(messages);
    expect(JSON.stringify(first)).not.toContain('heading Old');
    expect(JSON.stringify(first)).toContain('snapshot omitted');
    // The surrounding facts survive — the model still knows it looked here.
    expect(JSON.stringify(first)).toContain('https://example.com/');
    expect(JSON.stringify(last)).toContain('heading Current');
  });

  it('leaves a lone snapshot alone and is safe to reapply', () => {
    const messages = [snapshot('1', 'heading Only')];
    expect(elideStaleSnapshots(messages)).toEqual(messages);

    const twice = elideStaleSnapshots(elideStaleSnapshots([...messages, snapshot('2', 'newer')]));
    expect(JSON.stringify(twice)).toContain('newer');
    expect(JSON.stringify(twice)).not.toContain('heading Only');
  });

  it('never touches other tools — their results stay true after the fact', () => {
    const network: ModelMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'n1',
          toolName: 'list_network_requests',
          output: { type: 'json', value: { requests: ['GET /api/user 401'] } },
        },
      ],
    };

    const kept = elideStaleSnapshots([network, snapshot('1', 'a'), snapshot('2', 'b')]);
    expect(kept[0]).toEqual(network);
  });
});

describe('dropDanglingToolCalls', () => {
  const call = (id: string) => ({ type: 'tool-call' as const, toolCallId: id, toolName: 'click', input: {} });
  const result = (id: string) => ({
    type: 'tool-result' as const,
    toolCallId: id,
    toolName: 'click',
    output: { type: 'json' as const, value: { ok: true } },
  });

  it('keeps tool calls that were answered', () => {
    const messages: ModelMessage[] = [
      { role: 'assistant', content: [call('a')] },
      { role: 'tool', content: [result('a')] },
    ];
    expect(dropDanglingToolCalls(messages)).toEqual(messages);
  });

  it('drops a tool call the stop cut off before its result', () => {
    const messages: ModelMessage[] = [
      { role: 'assistant', content: [{ type: 'text', text: 'clicking' }, call('a'), call('b')] },
      { role: 'tool', content: [result('a')] },
    ];

    const kept = dropDanglingToolCalls(messages);
    expect(kept).toHaveLength(2);
    expect(kept[0].content).toEqual([{ type: 'text', text: 'clicking' }, call('a')]);
  });

  it('removes an assistant message that was nothing but an unanswered call', () => {
    const messages: ModelMessage[] = [
      { role: 'assistant', content: 'on it' },
      { role: 'assistant', content: [call('a')] },
    ];

    expect(dropDanglingToolCalls(messages)).toEqual([{ role: 'assistant', content: 'on it' }]);
  });
});
