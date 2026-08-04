import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { idbClearAll } from '../storage/idb';
import { loadLedger, saveLedger, MAX_LEDGERS } from './ledgerStore';
import {
  activateLedger,
  applyLedgerMutations,
  getActiveLedger,
  resetActiveLedger,
  subscribeLedger,
} from './activeLedger';
import { formatLedgerDigest } from './digest';
import { isLedgerEmpty, makeEmptyLedger, MAX_NOTES, type TaskLedger } from './types';

beforeEach(async () => {
  await idbClearAll();
  resetActiveLedger();
});

afterEach(async () => {
  await idbClearAll();
  resetActiveLedger();
});

function ledgerWith(overrides: Partial<TaskLedger>): TaskLedger {
  return { ...makeEmptyLedger('t1'), goal: 'find things', ...overrides };
}

describe('ledgerStore', () => {
  it('round-trips a ledger through IndexedDB', async () => {
    const ledger = ledgerWith({ notes: ['on page 3'] });
    await saveLedger(ledger);
    expect(await loadLedger('t1')).toEqual(ledger);
    expect(await loadLedger('other')).toBeNull();
  });

  it('drops a ledger that has been emptied out', async () => {
    await saveLedger(ledgerWith({}));
    await saveLedger(makeEmptyLedger('t1'));
    expect(await loadLedger('t1')).toBeNull();
  });

  it('prunes to the newest MAX_LEDGERS', async () => {
    for (let i = 0; i < MAX_LEDGERS + 3; i++) {
      await saveLedger({
        ...makeEmptyLedger(`t${i}`),
        goal: `goal ${i}`,
        updatedAt: 1000 + i,
      });
    }
    // The oldest three fell off; the newest survived.
    expect(await loadLedger('t0')).toBeNull();
    expect(await loadLedger('t2')).toBeNull();
    expect(await loadLedger(`t${MAX_LEDGERS + 2}`)).not.toBeNull();
  });
});

describe('activeLedger', () => {
  it('applies heterogeneous task-state mutations in one update', async () => {
    await activateLedger('t1');
    const ledger = await applyLedgerMutations([
      { type: 'set_goal', goal: 'find five verified sellers' },
      { type: 'replace_plan', plan: [{ text: 'scan comments', status: 'in_progress' }] },
      {
        type: 'upsert_finding',
        finding: {
          key: 'user-1',
          summary: 'currently selling',
          evidence: '我的房子正在挂牌',
          rationale: 'Direct present-tense selling evidence.',
        },
      },
      { type: 'add_note', text: 'post 1 scanned' },
    ]);

    expect(ledger).toMatchObject({
      goal: 'find five verified sellers',
      plan: [{ text: 'scan comments', status: 'in_progress' }],
      findings: [{ key: 'user-1', evidence: '我的房子正在挂牌' }],
      notes: ['post 1 scanned'],
    });
  });

  it('mutations require an activated ledger', async () => {
    await expect(
      applyLedgerMutations([{ type: 'add_note', text: 'lost' }]),
    ).rejects.toThrow(/no active task ledger/i);
  });

  it('persists an atomic mutation batch and notifies subscribers once', async () => {
    await activateLedger('t1');
    let notified = 0;
    const unsubscribe = subscribeLedger(() => notified++);

    await applyLedgerMutations([
      { type: 'set_goal', goal: 'collect 10 accounts' },
      { type: 'replace_plan', plan: [{ text: 'search' }] },
      {
        type: 'upsert_finding',
        finding: { key: 'user-1', summary: 'wants to sell', data: { url: 'https://x' } },
      },
    ]);

    expect(notified).toBe(1);
    unsubscribe();

    const stored = await loadLedger('t1');
    expect(stored?.goal).toBe('collect 10 accounts');
    expect(stored?.plan).toEqual([{ text: 'search', status: 'pending' }]);
    expect(stored?.findings).toHaveLength(1);
  });

  it('re-activating a thread reloads what tools wrote earlier', async () => {
    await activateLedger('t1');
    await applyLedgerMutations([{ type: 'add_note', text: 'left off at comment 40' }]);
    resetActiveLedger();

    const reloaded = await activateLedger('t1');
    expect(reloaded.notes).toEqual(['left off at comment 40']);
  });

  it('activating a fresh thread yields an empty ledger, not the previous thread’s', async () => {
    await activateLedger('t1');
    await applyLedgerMutations([
      { type: 'upsert_finding', finding: { key: 'a', summary: 'from thread 1' } },
    ]);

    const fresh = await activateLedger('t2');
    expect(isLedgerEmpty(fresh)).toBe(true);
    expect(getActiveLedger()?.threadId).toBe('t2');
  });

  it('upserts findings by key instead of duplicating', async () => {
    await activateLedger('t1');
    await applyLedgerMutations([
      { type: 'upsert_finding', finding: { key: 'user-1', summary: 'maybe selling' } },
    ]);
    await applyLedgerMutations([
      { type: 'upsert_finding', finding: { key: 'user-1', summary: 'definitely selling' } },
    ]);

    expect(getActiveLedger()?.findings).toHaveLength(1);
    expect(getActiveLedger()?.findings[0].summary).toBe('definitely selling');
  });

  it('keeps qualification evidence and can remove a finding that fails review', async () => {
    await activateLedger('t1');
    await applyLedgerMutations([{
      type: 'upsert_finding',
      finding: {
        key: 'user-1',
        summary: 'currently listing their apartment',
        evidence: '我的房子正在挂牌',
        rationale: 'Present-tense listing directly establishes current selling intent.',
      },
    }]);

    expect(getActiveLedger()?.findings[0]).toMatchObject({
      evidence: '我的房子正在挂牌',
      rationale: 'Present-tense listing directly establishes current selling intent.',
    });

    await applyLedgerMutations([
      { type: 'remove_finding', key: 'user-1', reason: 'Evidence was about a completed past sale.' },
    ]);
    expect(getActiveLedger()?.findings).toEqual([]);
  });

  it('drops oversized finding data rather than storing it', async () => {
    await activateLedger('t1');
    const ledger = await applyLedgerMutations([{
      type: 'upsert_finding',
      finding: {
        key: 'big',
        summary: 'huge payload',
        data: { blob: 'x'.repeat(5000) },
      },
    }]);
    expect(ledger.findings[0].data).toBeUndefined();
  });

  it('keeps only the newest MAX_NOTES notes', async () => {
    await activateLedger('t1');
    for (let i = 0; i < MAX_NOTES + 5; i++) {
      await applyLedgerMutations([{ type: 'add_note', text: `note ${i}` }]);
    }
    const notes = getActiveLedger()!.notes;
    expect(notes).toHaveLength(MAX_NOTES);
    expect(notes.at(-1)).toBe(`note ${MAX_NOTES + 4}`);
    expect(notes[0]).toBe('note 5');
  });
});

describe('formatLedgerDigest', () => {
  it('returns null for an empty ledger so no tokens are spent on it', () => {
    expect(formatLedgerDigest(makeEmptyLedger('t1'))).toBeNull();
  });

  it('shows goal, plan progress, findings and notes compactly', () => {
    const digest = formatLedgerDigest(
      ledgerWith({
        goal: 'find 10 sellers',
        plan: [
          { text: 'search hangzhou realty', status: 'done' },
          { text: 'scan comments', status: 'in_progress' },
        ],
        findings: [{
          key: 'user-1',
          summary: 'says "want to sell my flat"',
          evidence: '房子在挂牌，想尽快卖掉',
          rationale: 'Explicit present selling intent.',
          createdAt: 1,
        }],
        notes: ['post 3 comments done'],
      }),
    );

    expect(digest).toContain('Goal: find 10 sellers');
    expect(digest).toContain('Plan (1/2 done):');
    expect(digest).toContain('[in_progress] scan comments');
    expect(digest).toContain('Findings (1 saved):');
    expect(digest).toContain('user-1: says "want to sell my flat"');
    expect(digest).toContain('Evidence: 房子在挂牌，想尽快卖掉');
    expect(digest).toContain('Qualification: Explicit present selling intent.');
    expect(digest).toContain('post 3 comments done');
  });

  it('windows findings to the newest and counts the rest', () => {
    const findings = Array.from({ length: 40 }, (_, i) => ({
      key: `user-${i}`,
      summary: `summary ${i}`,
      createdAt: i,
    }));
    const digest = formatLedgerDigest(ledgerWith({ findings }))!;

    expect(digest).toContain('Findings (40 saved; newest 15 shown, 25 older omitted):');
    expect(digest).toContain('user-39');
    expect(digest).not.toContain('user-0:');
  });
});
