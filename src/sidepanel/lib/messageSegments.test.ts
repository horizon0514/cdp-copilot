import { describe, expect, it } from 'vitest';
import { buildMessageSegments, resolveParts } from './messageSegments';
import type { DisplayMessage, DisplayToolCall } from '../state/types';

function call(id: string, name = 'tool'): DisplayToolCall {
  return { id, name, args: {}, status: 'done' };
}

function message(partial: Partial<DisplayMessage> & Pick<DisplayMessage, 'toolCalls'>): DisplayMessage {
  return {
    id: 'm1',
    role: 'assistant',
    text: '',
    ...partial,
  };
}

describe('resolveParts', () => {
  it('uses recorded parts when present', () => {
    const parts = [
      { type: 'text' as const, text: 'looking…' },
      { type: 'tool' as const, id: '1' },
      { type: 'text' as const, text: 'done' },
    ];
    expect(resolveParts(message({ text: 'looking…done', toolCalls: [call('1')], parts }))).toEqual(
      parts,
    );
  });

  it('falls back to tools-then-text for legacy messages', () => {
    expect(
      resolveParts(message({ text: 'answer', toolCalls: [call('a'), call('b')] })),
    ).toEqual([
      { type: 'tool', id: 'a' },
      { type: 'tool', id: 'b' },
      { type: 'text', text: 'answer' },
    ]);
  });
});

describe('buildMessageSegments', () => {
  it('keeps consecutive tools in one segment and splits around text', () => {
    const segments = buildMessageSegments(
      message({
        text: 'hi\nbye',
        toolCalls: [call('1', 'click'), call('2', 'type'), call('3', 'snap')],
        parts: [
          { type: 'text', text: 'hi' },
          { type: 'tool', id: '1' },
          { type: 'tool', id: '2' },
          { type: 'text', text: 'bye' },
          { type: 'tool', id: '3' },
        ],
      }),
    );

    expect(segments.map((s) => s.kind)).toEqual(['text', 'tools', 'text', 'tools']);
    expect(segments[0]).toEqual({ kind: 'text', text: 'hi' });
    expect(segments[1]).toMatchObject({
      kind: 'tools',
      calls: [{ id: '1' }, { id: '2' }],
    });
    expect(segments[2]).toEqual({ kind: 'text', text: 'bye' });
    expect(segments[3]).toMatchObject({ kind: 'tools', calls: [{ id: '3' }] });
  });

  it('does not merge tool runs separated by text', () => {
    const segments = buildMessageSegments(
      message({
        text: 'mid',
        toolCalls: [call('1'), call('2')],
        parts: [
          { type: 'tool', id: '1' },
          { type: 'text', text: 'mid' },
          { type: 'tool', id: '2' },
        ],
      }),
    );

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ kind: 'tools', calls: [{ id: '1' }] });
    expect(segments[2]).toMatchObject({ kind: 'tools', calls: [{ id: '2' }] });
  });
});
