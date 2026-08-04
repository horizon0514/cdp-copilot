import { describe, it, expect } from 'vitest';
import type { ModelMessage } from 'ai';
import { isStalling, reflectionNote, REFLECT_INTERVAL } from './reflection';

function call(name: string, input: unknown): ModelMessage {
  return {
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId: crypto.randomUUID(), toolName: name, input }],
  };
}

describe('isStalling', () => {
  it('flags three identical calls in the recent window', () => {
    const history = [
      call('extract_content', { instruction: 'read comments' }),
      call('extract_content', { instruction: 'read comments' }),
      call('extract_content', { instruction: 'read comments' }),
    ];
    expect(isStalling(history)).toBe(true);
  });

  it('does not flag varied calls', () => {
    const history = [
      call('extract_content', { instruction: 'read comments' }),
      call('evaluate_script', { function: 'scroll' }),
      call('extract_content', { instruction: 'read more comments' }),
      call('update_task_ledger', { mutations: [{ type: 'upsert_finding', key: 'u1' }] }),
    ];
    expect(isStalling(history)).toBe(false);
  });

  it('does not flag identical calls once they age out of the window', () => {
    const stale = [
      call('extract_content', { instruction: 'x' }),
      call('extract_content', { instruction: 'x' }),
      call('extract_content', { instruction: 'x' }),
      // Six varied calls push the repeats out of the recent window.
      call('a', {}),
      call('b', {}),
      call('c', {}),
      call('d', {}),
      call('e', {}),
      call('f', {}),
    ];
    expect(isStalling(stale)).toBe(false);
  });
});

describe('reflectionNote', () => {
  it('returns nothing on an early, healthy step', () => {
    expect(reflectionNote(1, [call('extract_content', { instruction: 'a' })])).toBeNull();
  });

  it('injects the checkpoint on the interval', () => {
    const note = reflectionNote(REFLECT_INTERVAL, [call('extract_content', { instruction: 'a' })]);
    expect(note).toContain('Checkpoint');
  });

  it('prioritizes the stall prompt over the periodic checkpoint', () => {
    const spinning = [
      call('extract_content', { instruction: 'same' }),
      call('extract_content', { instruction: 'same' }),
      call('extract_content', { instruction: 'same' }),
    ];
    const note = reflectionNote(REFLECT_INTERVAL, spinning);
    expect(note).toContain('repeating the same action');
  });
});
