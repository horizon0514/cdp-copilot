import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { activateLedger, getActiveLedger, resetActiveLedger } from '../ledger/activeLedger';
import { formatLedgerDigest } from '../ledger/digest';
import { idbClearAll } from '../storage/idb';
import { tools } from '../tools';
import { scriptedModel } from '../../test/mockModel';
import { streamAgentEvents, type AgentEvent } from './agentLoop';
import { orchestrateAgentEvents } from './orchestrator';

beforeEach(async () => {
  await idbClearAll();
  resetActiveLedger();
  await activateLedger('orchestrator-test');
});

afterEach(async () => {
  await idbClearAll();
  resetActiveLedger();
});

describe('orchestrateAgentEvents', () => {
  it('runs a dispatched episode in fresh context and returns only its report to the root', async () => {
    const prompts: string[] = [];
    const model = scriptedModel(
      [
        {
          do: 'tool',
          name: 'control_task',
          input: {
            type: 'start_episode',
            objective: 'Inspect one comment section for a verified seller',
            rationale: 'Bounded collection slice',
          },
        },
        {
          do: 'tool',
          name: 'update_task_ledger',
          input: {
            mutations: [
              {
                type: 'upsert_finding',
                finding: {
                  key: 'user-1',
                  summary: 'currently listing a home',
                  evidence: '我的房子正在挂牌',
                  rationale: 'Direct present-tense selling evidence.',
                },
              },
            ],
          },
        },
        {
          do: 'tool',
          name: 'control_task',
          input: {
            type: 'finish_episode',
            status: 'done',
            summary: 'Found one verified seller',
            handoffNote: 'Choose another comment section next',
          },
        },
        {
          do: 'tool',
          name: 'control_task',
          input: { type: 'complete', summary: 'Collection complete' },
        },
      ],
      (prompt) => prompts.push(JSON.stringify(prompt)),
    );

    const run = (messages: ModelMessage[], mode: 'root' | 'episode') =>
      streamAgentEvents(model, messages, {
        toolset: tools,
        maxSteps: 5,
        extraInstructions: () => {
          const ledger = getActiveLedger();
          const digest = ledger ? formatLedgerDigest(ledger) : null;
          return [mode === 'episode' ? 'EPISODE MODE' : 'ROOT MODE', digest].filter(Boolean).join('\n\n');
        },
      });

    const events: AgentEvent[] = [];
    for await (const event of orchestrateAgentEvents(
      [{ role: 'user', content: 'Find one seller' }],
      run,
    )) {
      events.push(event);
    }

    expect(getActiveLedger()?.findings.map((finding) => finding.key)).toEqual(['user-1']);
    expect(getActiveLedger()?.notes.at(-1)).toContain('Choose another comment section next');
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
    expect(events.some((event) => event.type === 'text-delta' && event.text === 'Collection complete')).toBe(true);

    expect(prompts[1]).toContain('EPISODE MODE');
    expect(prompts[1]).toContain('Inspect one comment section for a verified seller');
    expect(prompts[1]).not.toContain('Find one seller');

    const resumedRoot = prompts.at(-1)!;
    expect(resumedRoot).toContain('ROOT MODE');
    expect(resumedRoot).toContain('Found one verified seller');
    expect(resumedRoot).not.toContain('"toolName":"update_task_ledger"');
  });

  it('keeps simple tasks on one root run', async () => {
    const modes: Array<'root' | 'episode'> = [];
    const model = scriptedModel([{ do: 'text', text: 'clicked' }]);
    const run = (messages: ModelMessage[], mode: 'root' | 'episode') => {
      modes.push(mode);
      return streamAgentEvents(model, messages, { toolset: tools, maxSteps: 2 });
    };

    const events: AgentEvent[] = [];
    for await (const event of orchestrateAgentEvents(
      [{ role: 'user', content: 'Click login' }],
      run,
    )) {
      events.push(event);
    }

    expect(modes).toEqual(['root']);
    expect(events.some((event) => event.type === 'text-delta' && event.text === 'clicked')).toBe(true);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
  });
});
