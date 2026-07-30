import { describe, it, expect } from 'vitest';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { streamAgentEvents, buildMessages, type AgentEvent, type StopInfo } from './agentLoop';
import { scriptedModel, type StepScript } from '../../test/mockModel';

const okTool = tool({
  description: 'succeeds',
  inputSchema: z.object({}),
  execute: async () => ({ ok: true }),
});

const throwingTool = tool({
  description: 'always throws',
  inputSchema: z.object({}),
  // Annotated because an execute that only throws infers as Promise<never>,
  // which breaks tool()'s overload resolution.
  execute: async (): Promise<{ ok: boolean }> => {
    throw new Error('uid "7" is not from the latest snapshot.');
  },
});

const toolset: ToolSet = { okTool, throwingTool };

async function collect(script: StepScript[], maxSteps = 20) {
  const events: AgentEvent[] = [];
  for await (const e of streamAgentEvents(scriptedModel(script), [{ role: 'user', content: 'go' }], {
    toolset,
    maxSteps,
  })) {
    events.push(e);
  }
  const text = events
    .filter((e): e is Extract<AgentEvent, { type: 'text-delta' }> => e.type === 'text-delta')
    .map((e) => e.text)
    .join('');
  const done = events.find((e): e is Extract<AgentEvent, { type: 'done' }> => e.type === 'done');
  return { events, text, stop: done?.stop as StopInfo | undefined };
}

describe('streamAgentEvents — ReAct loop', () => {
  it('runs multiple steps: tool call, then a final answer', async () => {
    const { events, text, stop } = await collect([
      { do: 'tool', name: 'okTool' },
      { do: 'text', text: 'all done' },
    ]);

    expect(events.map((e) => e.type)).toEqual([
      'tool-call',
      'tool-result',
      'text-delta',
      'done',
    ]);
    expect(text).toBe('all done');
    expect(stop).toMatchObject({ finishReason: 'stop', steps: 2, hitStepLimit: false });
  });

  it('feeds a thrown tool error back to the model instead of aborting the loop', async () => {
    const { events, text, stop } = await collect([
      { do: 'tool', name: 'throwingTool' },
      { do: 'text', text: 'recovered' },
    ]);

    const types = events.map((e) => e.type);
    expect(types).toContain('tool-error');
    // The loop must continue past the failure and still produce an answer.
    expect(text).toBe('recovered');
    expect(stop?.steps).toBe(2);
  });

  it('surfaces the tool error message so the UI can show it', async () => {
    const { events } = await collect([
      { do: 'tool', name: 'throwingTool' },
      { do: 'text', text: 'ok' },
    ]);
    const err = events.find((e) => e.type === 'tool-error');
    expect(err).toMatchObject({ name: 'throwingTool' });
    expect((err as Extract<AgentEvent, { type: 'tool-error' }>).error).toContain('not from the latest snapshot');
  });
});

describe('streamAgentEvents — StopInfo diagnostics', () => {
  it('flags hitStepLimit when the model keeps calling tools forever', async () => {
    const { stop } = await collect([{ do: 'tool', name: 'okTool' }], 3);

    expect(stop).toMatchObject({ steps: 3, hitStepLimit: true, finishReason: 'tool-calls' });
  });

  it('distinguishes "ran tools but produced no answer" from a healthy stop', async () => {
    const { text, stop } = await collect([
      { do: 'tool', name: 'okTool' },
      { do: 'silent' },
    ]);

    expect(text).toBe('');
    // Looks like a clean stop, but there is no answer — this is the case the UI
    // must explain rather than silently render an empty message.
    expect(stop).toMatchObject({ finishReason: 'stop', hitStepLimit: false });
  });

  it('reports token usage', async () => {
    const { stop } = await collect([{ do: 'text', text: 'hi' }]);
    expect(stop?.totalTokens).toBe(120);
  });

  it('yields an error event when the stream errors', async () => {
    const { events } = await collect([{ do: 'error', message: 'context length exceeded' }]);
    const err = events.find((e) => e.type === 'error');
    expect((err as Extract<AgentEvent, { type: 'error' }>).message).toContain('context length exceeded');
  });
});

describe('buildMessages', () => {
  it('appends the user message after history and never emits a system role', () => {
    const messages = buildMessages(
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
      ],
      'second',
    );

    expect(messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ]);
    // AI SDK v7 rejects system messages here; the prompt goes via `instructions`.
    expect(messages.some((m) => m.role === 'system')).toBe(false);
  });
});
