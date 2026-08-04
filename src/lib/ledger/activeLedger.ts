import { loadLedger, saveLedger } from './ledgerStore';
import {
  makeEmptyLedger,
  MAX_FINDING_DATA_CHARS,
  MAX_FINDING_SUMMARY_CHARS,
  MAX_FINDINGS,
  MAX_GOAL_CHARS,
  MAX_NOTE_CHARS,
  MAX_NOTES,
  MAX_PLAN_ITEMS,
  MAX_PLAN_TEXT_CHARS,
  type Finding,
  type PlanItem,
  type TaskLedger,
} from './types';

/**
 * The ledger of the thread currently shown in the side panel. Ledger tools run
 * deep in the tool layer with no access to UI state, so — like the bound-tab
 * binding in tools/context.ts — the active thread is module state, set by the
 * panel when a thread is opened and re-asserted before each turn.
 */
let active: TaskLedger | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to active-ledger changes (UI). Returns an unsubscribe function. */
export function subscribeLedger(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveLedger(): TaskLedger | null {
  return active;
}

/** Load (or create) the ledger for a thread and make it the active one. */
export async function activateLedger(threadId: string): Promise<TaskLedger> {
  active = (await loadLedger(threadId)) ?? makeEmptyLedger(threadId);
  notify();
  return active;
}

/** Test helper. */
export function resetActiveLedger(): void {
  active = null;
  notify();
}

function requireActive(): TaskLedger {
  if (!active) {
    throw new Error('No active task ledger — the side panel has not opened a thread yet.');
  }
  return active;
}

async function commit(next: TaskLedger): Promise<TaskLedger> {
  active = { ...next, updatedAt: Date.now() };
  await saveLedger(active);
  notify();
  return active;
}

function clamp(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export interface PlanUpdate {
  goal?: string;
  plan?: Array<{ text: string; status?: PlanItem['status'] }>;
}

/** Replace goal and/or the whole plan list (full replacement — no id bookkeeping). */
export async function applyPlanUpdate(update: PlanUpdate): Promise<TaskLedger> {
  const ledger = requireActive();
  return commit({
    ...ledger,
    goal: update.goal !== undefined ? clamp(update.goal, MAX_GOAL_CHARS) : ledger.goal,
    plan:
      update.plan !== undefined
        ? update.plan.slice(0, MAX_PLAN_ITEMS).map((item) => ({
            text: clamp(item.text, MAX_PLAN_TEXT_CHARS),
            status: item.status ?? 'pending',
          }))
        : ledger.plan,
  });
}

export interface RecordFindingResult {
  ledger: TaskLedger;
  /** False when the key already existed and the entry was updated in place. */
  isNew: boolean;
  /** True when `data` was too large to keep and was dropped. */
  dataDropped: boolean;
}

/** Upsert a finding by key. Updated entries move to the end (= newest in the digest). */
export async function recordFinding(input: {
  key: string;
  summary: string;
  data?: Record<string, unknown>;
}): Promise<RecordFindingResult> {
  const ledger = requireActive();
  const key = clamp(input.key, 200);
  const existing = ledger.findings.find((f) => f.key === key);

  if (!existing && ledger.findings.length >= MAX_FINDINGS) {
    throw new Error(`Findings limit reached (${MAX_FINDINGS}) — the task result set is full.`);
  }

  let data = input.data;
  let dataDropped = false;
  if (data !== undefined && JSON.stringify(data).length > MAX_FINDING_DATA_CHARS) {
    data = undefined;
    dataDropped = true;
  }

  const finding: Finding = {
    key,
    summary: clamp(input.summary, MAX_FINDING_SUMMARY_CHARS),
    ...(data !== undefined ? { data } : {}),
    createdAt: existing?.createdAt ?? Date.now(),
  };

  const next = await commit({
    ...ledger,
    findings: [...ledger.findings.filter((f) => f.key !== key), finding],
  });
  return { ledger: next, isNew: !existing, dataDropped };
}

/** Append a handoff note, keeping only the newest MAX_NOTES. */
export async function recordNote(text: string): Promise<TaskLedger> {
  const ledger = requireActive();
  return commit({
    ...ledger,
    notes: [...ledger.notes, clamp(text, MAX_NOTE_CHARS)].slice(-MAX_NOTES),
  });
}
