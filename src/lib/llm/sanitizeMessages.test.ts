import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { dropDanglingToolCalls, sanitizeModelMessages, sanitizeValue } from './sanitizeMessages';

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
