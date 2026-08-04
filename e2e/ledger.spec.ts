import { test, expect, callTool, type StoredLedger } from './extension';
import type { Page } from '@playwright/test';

/**
 * Drives the durable task-ledger tools through the real extension runtime:
 * tool executions run in the extension page, and every mutation lands in the
 * extension origin's IndexedDB. Re-activating a thread reloads from that store,
 * so a surviving finding proves the round trip, not just in-memory state.
 */

async function activate(panel: Page, threadId: string): Promise<StoredLedger> {
  return panel.evaluate((id) => window.__cdp.ledger.activate(id), threadId);
}

function ledger(panel: Page): Promise<StoredLedger | null> {
  return panel.evaluate(() => window.__cdp.ledger.get());
}

test('update_task_ledger records the goal and plan and reports progress', async ({ panel }) => {
  await activate(panel, 'e2e-plan');

  const result = await callTool<{ planTotal: number; planDone: number; findingsSaved: number }>(
    panel,
    'update_task_ledger',
    {
      mutations: [
        { type: 'set_goal', goal: 'find 3 sellers' },
        {
          type: 'replace_plan',
          plan: [
            { text: 'search listings', status: 'done' },
            { text: 'scan comments', status: 'in_progress' },
            { text: 'compile table' },
          ],
        },
      ],
    },
  );

  expect(result).toMatchObject({ planTotal: 3, planDone: 1, findingsSaved: 0 });

  const state = await ledger(panel);
  expect(state?.goal).toBe('find 3 sellers');
  expect(state?.plan).toHaveLength(3);
  expect(state?.plan[1]).toMatchObject({ text: 'scan comments', status: 'in_progress' });
});

test('update_task_ledger dedupes findings by key and updates in place', async ({ panel }) => {
  await activate(panel, 'e2e-findings');

  const first = await callTool<{ findingsSaved: number }>(panel, 'update_task_ledger', {
    mutations: [{
      type: 'upsert_finding',
      finding: {
        key: 'user-1',
        summary: 'maybe selling',
        evidence: '考虑挂牌',
        rationale: 'Possible present intent.',
        data: { url: 'https://x/u/1' },
      },
    }],
  });
  expect(first).toMatchObject({ findingsSaved: 1 });

  const dup = await callTool<{ findingsSaved: number }>(panel, 'update_task_ledger', {
    mutations: [{
      type: 'upsert_finding',
      finding: {
        key: 'user-1',
        summary: 'definitely selling',
        evidence: '房子正在挂牌',
        rationale: 'Direct current listing.',
      },
    }],
  });
  expect(dup).toMatchObject({ findingsSaved: 1 });

  const state = await ledger(panel);
  expect(state?.findings).toHaveLength(1);
  expect(state?.findings[0].summary).toBe('definitely selling');
});

test('findings survive a reload from IndexedDB', async ({ panel }) => {
  await activate(panel, 'e2e-persist');
  await callTool(panel, 'update_task_ledger', {
    mutations: [
      {
        type: 'upsert_finding',
        finding: {
          key: 'acc-42',
          summary: 'wants to sell downtown flat',
          evidence: '市中心的房子想卖',
          rationale: 'Explicit current selling intent.',
        },
      },
      { type: 'add_note', text: 'stopped at comment 40 of note 3' },
    ],
  });

  // Re-activating reloads the ledger from IndexedDB, discarding in-memory state.
  const reloaded = await activate(panel, 'e2e-persist');
  expect(reloaded.findings.map((f) => f.key)).toContain('acc-42');
  expect(reloaded.notes).toContain('stopped at comment 40 of note 3');
});

test('ledgers are isolated per thread', async ({ panel }) => {
  await activate(panel, 'e2e-thread-x');
  await callTool(panel, 'update_task_ledger', {
    mutations: [{
      type: 'upsert_finding',
      finding: {
        key: 'x-only',
        summary: 'belongs to x',
        evidence: 'thread x evidence',
        rationale: 'Matches the test criterion.',
      },
    }],
  });

  const other = await activate(panel, 'e2e-thread-y');
  expect(other.findings).toHaveLength(0);
  expect(other.goal).toBeNull();
});

test('control_task acknowledges the action that ends the turn', async ({ panel }) => {
  const result = await callTool<{ accepted: boolean; type: string; summary: string }>(panel, 'control_task', {
    type: 'complete',
    summary: 'found all 3 sellers — see ledger',
  });
  expect(result).toEqual({
    accepted: true,
    type: 'complete',
    summary: 'found all 3 sellers — see ledger',
  });
});
