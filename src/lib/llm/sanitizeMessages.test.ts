import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { sanitizeModelMessages, sanitizeValue } from './sanitizeMessages';

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
