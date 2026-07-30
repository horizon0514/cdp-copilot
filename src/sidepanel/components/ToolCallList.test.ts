import { describe, expect, it } from 'vitest';
import { groupToolCalls } from './ToolCallList';
import type { DisplayToolCall } from '../state/conversationStore';

function call(
  id: string,
  status: DisplayToolCall['status'],
  name = 'tool',
): DisplayToolCall {
  return { id, name, args: {}, status };
}

describe('groupToolCalls', () => {
  it('keeps a running tool as its own visible group', () => {
    expect(groupToolCalls([call('1', 'running', 'click')])).toEqual([
      { kind: 'single', call: call('1', 'running', 'click') },
    ]);
  });

  it('keeps freshly finished tools ungrouped until settled', () => {
    const groups = groupToolCalls(
      [call('1', 'done', 'a'), call('2', 'done', 'b')],
      new Set(), // none settled yet
    );
    expect(groups.map((g) => g.kind)).toEqual(['single', 'single']);
  });

  it('collapses consecutive settled successes into one group', () => {
    const groups = groupToolCalls(
      [call('1', 'done', 'a'), call('2', 'done', 'b'), call('3', 'done', 'c')],
      new Set(['1', '2', '3']),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: 'successes' });
    if (groups[0].kind === 'successes') {
      expect(groups[0].calls.map((c) => c.id)).toEqual(['1', '2', '3']);
    }
  });

  it('only groups the settled prefix while a newer done is still open', () => {
    const groups = groupToolCalls(
      [call('1', 'done', 'a'), call('2', 'done', 'b'), call('3', 'done', 'c')],
      new Set(['1', '2']),
    );
    expect(groups.map((g) => g.kind)).toEqual(['successes', 'single']);
    expect(groups[1]).toMatchObject({ kind: 'single', call: { id: '3' } });
  });

  it('leaves errors ungrouped and splits success runs around them', () => {
    const groups = groupToolCalls(
      [
        call('1', 'done', 'a'),
        call('2', 'done', 'b'),
        call('3', 'error', 'fail'),
        call('4', 'done', 'c'),
        call('5', 'running', 'now'),
      ],
      new Set(['1', '2', '4']),
    );
    expect(groups.map((g) => g.kind)).toEqual(['successes', 'single', 'single', 'single']);
    expect(groups[1]).toMatchObject({ kind: 'single', call: { id: '3', status: 'error' } });
    expect(groups[3]).toMatchObject({ kind: 'single', call: { id: '5', status: 'running' } });
  });

  it('does not wrap a lone settled success in a multi-tool group', () => {
    expect(groupToolCalls([call('1', 'done')], new Set(['1']))).toEqual([
      { kind: 'single', call: call('1', 'done') },
    ]);
  });
});
