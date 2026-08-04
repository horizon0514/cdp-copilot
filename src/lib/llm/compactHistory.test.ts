import { describe, it, expect } from 'vitest';
import type { ModelMessage } from 'ai';
import { compactHistory } from './compactHistory';

const request: ModelMessage = { role: 'user', content: 'find 10 sellers' };

function assistantCall(id: string): ModelMessage {
  return {
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId: id, toolName: 'extract_content', input: { instruction: 'x' } }],
  };
}

function toolResult(id: string, filler: string): ModelMessage {
  return {
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: id, toolName: 'extract_content', output: { type: 'json', value: { filler } } }],
  };
}

/** A long transcript: request, then N call/result pairs each carrying `pad` bytes. */
function longHistory(pairs: number, pad: number): ModelMessage[] {
  const messages: ModelMessage[] = [request];
  for (let i = 0; i < pairs; i++) {
    messages.push(assistantCall(`c${i}`));
    messages.push(toolResult(`c${i}`, 'y'.repeat(pad)));
  }
  return messages;
}

describe('compactHistory', () => {
  it('leaves a small history untouched', () => {
    const messages = longHistory(3, 100);
    expect(compactHistory(messages)).toBe(messages);
  });

  it('trims an oversized history down to a recent tail', () => {
    const messages = longHistory(60, 5_000);
    const out = compactHistory(messages);
    expect(out.length).toBeLessThan(messages.length);
    expect(JSON.stringify(out).length).toBeLessThan(JSON.stringify(messages).length);
  });

  it('keeps the original request as the anchor with a trim note', () => {
    const out = compactHistory(longHistory(60, 5_000));
    expect(out[0].role).toBe('user');
    expect(out[0].content).toContain('find 10 sellers');
    expect(out[0].content).toContain('trimmed to save context');
  });

  it('never opens the tail on an orphaned tool result', () => {
    const out = compactHistory(longHistory(60, 5_000));
    // messages[0] is the anchor; messages[1] onward must not start with a tool
    // message whose tool-call was trimmed away.
    expect(out[1].role).not.toBe('tool');
  });

  it('respects a custom keep budget', () => {
    const wide = compactHistory(longHistory(60, 5_000), { triggerChars: 1000, keepChars: 100_000 });
    const narrow = compactHistory(longHistory(60, 5_000), { triggerChars: 1000, keepChars: 20_000 });
    expect(narrow.length).toBeLessThan(wide.length);
  });
});
