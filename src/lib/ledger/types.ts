/**
 * The task ledger is the agent's durable memory: goal, plan, findings and
 * handoff notes live here instead of in the conversation, so they survive
 * context trimming, "continue" turns, and (later) fresh-context episodes.
 */

export type PlanItemStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface PlanItem {
  text: string;
  status: PlanItemStatus;
}

export interface Finding {
  /** Stable dedup key chosen by the model (account id, URL, …). */
  key: string;
  /** One-line human-readable summary. */
  summary: string;
  /** Direct quote or observed value that proves this result meets the goal. */
  evidence?: string;
  /** Why that evidence meets the task's criteria. */
  rationale?: string;
  /** Optional structured payload worth keeping verbatim. */
  data?: Record<string, unknown>;
  createdAt: number;
}

export interface TaskLedger {
  threadId: string;
  goal: string | null;
  plan: PlanItem[];
  findings: Finding[];
  /** Handoff notes, newest last. */
  notes: string[];
  updatedAt: number;
}

// Caps keep a runaway model from turning the ledger into a second context
// window — the digest injected each step must stay small.
export const MAX_PLAN_ITEMS = 30;
export const MAX_FINDINGS = 200;
export const MAX_NOTES = 10;
export const MAX_GOAL_CHARS = 500;
export const MAX_PLAN_TEXT_CHARS = 200;
export const MAX_FINDING_SUMMARY_CHARS = 300;
export const MAX_FINDING_EVIDENCE_CHARS = 500;
export const MAX_FINDING_RATIONALE_CHARS = 300;
export const MAX_FINDING_DATA_CHARS = 2_000;
export const MAX_NOTE_CHARS = 500;

export function makeEmptyLedger(threadId: string): TaskLedger {
  return {
    threadId,
    goal: null,
    plan: [],
    findings: [],
    notes: [],
    updatedAt: Date.now(),
  };
}

export function isLedgerEmpty(ledger: TaskLedger): boolean {
  return (
    ledger.goal == null &&
    ledger.plan.length === 0 &&
    ledger.findings.length === 0 &&
    ledger.notes.length === 0
  );
}
