import { beforeEach, describe, it, expect } from 'vitest';
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

async function collect(
  script: StepScript[],
  maxSteps = 20,
  options: { abortSignal?: AbortSignal; toolset?: ToolSet } = {},
) {
  const events: AgentEvent[] = [];
  for await (const e of streamAgentEvents(scriptedModel(script), [{ role: 'user', content: 'go' }], {
    toolset: options.toolset ?? toolset,
    maxSteps,
    abortSignal: options.abortSignal,
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
  it('can hide orchestration controls from a simple-task step', async () => {
    const advertised: unknown[] = [];
    const control_task = tool({
      description: 'orchestration control',
      inputSchema: z.object({ type: z.literal('complete') }),
      execute: async () => ({ accepted: true }),
    });
    const model = scriptedModel(
      [{ do: 'text', text: 'simple answer' }],
      undefined,
      (modelTools) => advertised.push(modelTools),
    );

    for await (const _ of streamAgentEvents(model, [{ role: 'user', content: 'say hello' }], {
      toolset: { okTool, control_task },
      activeTools: () => ['okTool'],
    })) {
      void _;
    }

    expect(JSON.stringify(advertised[0])).toContain('okTool');
    expect(JSON.stringify(advertised[0])).not.toContain('control_task');
  });

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

describe('streamAgentEvents — keeping a long turn inside the context window', () => {
  /** Stands in for take_snapshot: a big payload whose uids die on the next call. */
  const snapshotTool = tool({
    description: 'snapshots the page',
    inputSchema: z.object({}),
    execute: async () => ({ url: 'https://example.com/', snapshot: `PAGE-${++snapshots}`, uidCount: 3 }),
  });
  let snapshots = 0;

  beforeEach(() => {
    snapshots = 0;
  });

  it('stops resending snapshots the model has already superseded', async () => {
    const prompts: string[] = [];
    const model = scriptedModel(
      [
        { do: 'tool', name: 'take_snapshot' },
        { do: 'tool', name: 'take_snapshot' },
        { do: 'text', text: 'done' },
      ],
      (prompt) => prompts.push(JSON.stringify(prompt)),
    );

    for await (const _ of streamAgentEvents(model, [{ role: 'user', content: 'go' }], {
      toolset: { take_snapshot: snapshotTool },
      maxSteps: 5,
    })) {
      void _;
    }

    // Third call: two snapshots have been taken, only the newer may be sent.
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).not.toContain('PAGE-1');
    expect(prompts[2]).toContain('PAGE-2');
    expect(prompts[2]).toContain('snapshot omitted');
    // The second call still carried the only snapshot that existed then.
    expect(prompts[1]).toContain('PAGE-1');
  });
});

describe('streamAgentEvents — goal-driven stop', () => {
  const control_task = tool({
    description: 'controls the task',
    inputSchema: z.object({ type: z.literal('complete'), summary: z.string() }),
    execute: async ({ type, summary }: { type: 'complete'; summary: string }) => ({
      accepted: true,
      type,
      summary,
    }),
  });

  it('stops as soon as the model yields a control action, well under the step limit', async () => {
    const { events, stop } = await collect(
      [
        { do: 'tool', name: 'okTool' },
        { do: 'tool', name: 'control_task', input: { type: 'complete', summary: 'done — 10 found' } },
        { do: 'text', text: 'should never run' },
      ],
      50,
      { toolset: { okTool, control_task } },
    );

    expect(stop?.hitStepLimit).toBe(false);
    expect(stop?.steps).toBe(2);
    // The turn ended at control_task — the third scripted step never ran.
    expect(events.some((e) => e.type === 'text-delta')).toBe(false);
    const done = events.find((e) => e.type === 'done');
    expect(JSON.stringify(done)).toContain('control_task');
  });
});

describe('streamAgentEvents — extra instructions (task-ledger digest)', () => {
  it('requires evidence-based findings and live plan tracking in the system prompt', async () => {
    const prompts: string[] = [];
    const model = scriptedModel(
      [{ do: 'text', text: 'done' }],
      (prompt) => prompts.push(JSON.stringify(prompt)),
    );

    for await (const _ of streamAgentEvents(model, [{ role: 'user', content: 'collect five items' }], {
      toolset,
      maxSteps: 2,
    })) {
      void _;
    }

    expect(prompts[0]).toContain('require direct evidence');
    expect(prompts[0]).toContain('do not stretch ambiguous');
    expect(prompts[0]).toContain('update_task_ledger');
    expect(prompts[0]).toContain('set_plan_status');
    expect(prompts[0]).toContain('Treat the plan as live work tracking');
    expect(prompts[0]).toContain('evaluate_script, when structure identifies');
    expect(prompts[0]).toContain('extract_content, when meaning identifies');
  });

  it('appends the digest to the system prompt on every step, staying current', async () => {
    const prompts: string[] = [];
    let findings = 0;
    const savingTool = tool({
      description: 'saves a finding',
      inputSchema: z.object({}),
      execute: async () => ({ saved: ++findings }),
    });

    const model = scriptedModel(
      [
        { do: 'tool', name: 'savingTool' },
        { do: 'tool', name: 'savingTool' },
        { do: 'text', text: 'done' },
      ],
      (prompt) => prompts.push(JSON.stringify(prompt)),
    );

    for await (const _ of streamAgentEvents(model, [{ role: 'user', content: 'go' }], {
      toolset: { savingTool },
      maxSteps: 5,
      extraInstructions: () => `Findings so far: ${findings}`,
    })) {
      void _;
    }

    expect(prompts).toHaveLength(3);
    // Re-evaluated before each step, so mid-turn tool writes show up next step.
    expect(prompts[0]).toContain('Findings so far: 0');
    expect(prompts[1]).toContain('Findings so far: 1');
    expect(prompts[2]).toContain('Findings so far: 2');
    // The base system prompt is still there alongside the digest.
    expect(prompts[2]).toContain('You are Pagehand');
  });

  it('sends the bare system prompt when there is nothing extra', async () => {
    const prompts: string[] = [];
    const model = scriptedModel(
      [{ do: 'text', text: 'hi' }],
      (prompt) => prompts.push(JSON.stringify(prompt)),
    );

    for await (const _ of streamAgentEvents(model, [{ role: 'user', content: 'go' }], {
      toolset,
      maxSteps: 2,
      extraInstructions: () => null,
    })) {
      void _;
    }

    expect(prompts[0]).toContain('You are Pagehand');
    expect(prompts[0]).not.toContain('Findings so far');
  });
});

describe('streamAgentEvents — stopping a running turn', () => {
  it('ends the turn as aborted, not as an error, when the signal fires mid-run', async () => {
    const controller = new AbortController();
    const stoppingTool = tool({
      description: 'stops the turn while it runs',
      inputSchema: z.object({}),
      execute: async () => {
        controller.abort();
        return { ok: true };
      },
    });

    const { events, stop } = await collect(
      // The script would run forever; only the abort can end it.
      [{ do: 'tool', name: 'stoppingTool' }],
      20,
      { abortSignal: controller.signal, toolset: { stoppingTool } },
    );

    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(stop).toMatchObject({ aborted: true, finishReason: 'abort' });
  });

  it('stops before the first model call when the signal is already aborted', async () => {
    const { events, stop } = await collect([{ do: 'text', text: 'never sent' }], 20, {
      abortSignal: AbortSignal.abort(),
    });

    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(stop).toMatchObject({ aborted: true, steps: 0 });
    const done = events.find((e) => e.type === 'done');
    if (done?.type !== 'done') throw new Error('expected done');
    // History still has to alternate — the turn owes the user message a reply.
    expect(done.responseMessages).toEqual([
      { role: 'assistant', content: '[Stopped by the user before I finished this turn.]' },
    ]);
  });

  it('never hands back a tool call whose result the stop cut off', async () => {
    const controller = new AbortController();
    const stoppingTool = tool({
      description: 'stops the turn while it runs',
      inputSchema: z.object({}),
      execute: async () => {
        controller.abort();
        return { ok: true };
      },
    });

    const { events } = await collect([{ do: 'tool', name: 'stoppingTool' }], 20, {
      abortSignal: controller.signal,
      toolset: { stoppingTool },
    });
    const done = events.find((e) => e.type === 'done');
    if (done?.type !== 'done') throw new Error('expected done');

    const answered = new Set(
      done.responseMessages.flatMap((m) =>
        m.role === 'tool' && Array.isArray(m.content)
          ? m.content.filter((p) => p.type === 'tool-result').map((p) => p.toolCallId)
          : [],
      ),
    );
    const calls = done.responseMessages.flatMap((m) =>
      m.role === 'assistant' && Array.isArray(m.content)
        ? m.content.filter((p) => p.type === 'tool-call').map((p) => p.toolCallId)
        : [],
    );
    expect(calls.every((id) => answered.has(id))).toBe(true);
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

  it('preserves tool-call / tool-result parts already in history', () => {
    const history = [
      { role: 'user' as const, content: 'click it' },
      {
        role: 'assistant' as const,
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: 'c1',
            toolName: 'okTool',
            input: {},
          },
        ],
      },
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'c1',
            toolName: 'okTool',
            output: { type: 'json' as const, value: { ok: true } },
          },
        ],
      },
      { role: 'assistant' as const, content: 'clicked' },
    ];
    const messages = buildMessages(history, 'now type');
    expect(messages).toHaveLength(5);
    expect(messages[1]).toMatchObject({ role: 'assistant' });
    expect(messages[2]).toMatchObject({ role: 'tool' });
    expect(messages[4]).toEqual({ role: 'user', content: 'now type' });
  });
});

describe('streamAgentEvents — responseMessages for multi-turn history', () => {
  it('returns responseMessages on done so the caller can persist a faithful history', async () => {
    const { events } = await collect([
      { do: 'tool', name: 'okTool' },
      { do: 'text', text: 'all done' },
    ]);
    const done = events.find((e) => e.type === 'done');
    expect(done?.type).toBe('done');
    if (done?.type !== 'done') throw new Error('expected done');
    expect(done.responseMessages.length).toBeGreaterThan(0);
    const roles = done.responseMessages.map((m) => m.role);
    expect(roles).toContain('assistant');
    // Tool results land as role:'tool' (or nested in assistant, depending on SDK);
    // either way the payload must retain a tool-call or tool-result part.
    const serialized = JSON.stringify(done.responseMessages);
    expect(serialized).toMatch(/tool-call|tool-result|okTool/);
  });
});
