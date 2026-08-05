import { tool } from 'ai';
import { z } from 'zod';
import { applyLedgerMutations } from '../ledger/activeLedger';
import type { TaskLedger } from '../ledger/types';

/**
 * Ledger tools write to durable per-thread storage instead of returning data
 * into the conversation. Results are small acks on purpose: the model already
 * sees the full ledger state in its instructions every step, so echoing it
 * back here would just pay for it twice.
 */

function progress(ledger: TaskLedger) {
  const done = ledger.plan.filter((p) => p.status === 'done' || p.status === 'skipped').length;
  return {
    planDone: done,
    planTotal: ledger.plan.length,
    findingsSaved: ledger.findings.length,
  };
}

const planItem = z.object({
  text: z.string().describe('One short step'),
  status: z.enum(['pending', 'in_progress', 'done', 'skipped']).optional(),
});

const finding = z.object({
  key: z.string().describe('Stable dedup key — a URL, id, or other unique identifier'),
  summary: z.string().describe('One-line human-readable description of the result'),
  evidence: z
    .string()
    .describe('Verbatim page quote or directly observed value that supports the result'),
  rationale: z
    .string()
    .describe('How the evidence meets the goal’s criteria'),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional compact structured fields worth keeping verbatim'),
});

const mutation = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_goal'),
    goal: z.string().describe('Overall goal with a clear success criterion'),
  }),
  z.object({
    type: z.literal('replace_plan'),
    plan: z.array(planItem).describe('The full replacement plan — only when the steps themselves change'),
  }),
  z.object({
    type: z.literal('set_plan_status'),
    step: z
      .number()
      .int()
      .positive()
      .describe('1-based plan step index from the ledger digest (1 = first step)'),
    status: z
      .enum(['pending', 'in_progress', 'done', 'skipped'])
      .describe('New status for that step'),
  }),
  z.object({
    type: z.literal('upsert_finding'),
    finding,
  }),
  z.object({
    type: z.literal('remove_finding'),
    key: z.string().describe('Exact stable key of the invalid or outdated finding'),
    reason: z.string().describe('Why it no longer meets the goal’s criteria'),
  }),
  z.object({
    type: z.literal('add_note'),
    text: z.string().describe('One- or two-sentence handoff note'),
  }),
]);

export const update_task_ledger = tool({
  description:
    'Atomically updates durable task state with one or more typed mutations. Use it to set the goal, ' +
    'replace the plan when steps change, set_plan_status as you start/finish each step, upsert or remove ' +
    'verified findings, and append handoff notes. Prefer set_plan_status over rewriting the whole plan. ' +
    'The ledger appears in your instructions every step and survives history trimming. Only upsert a ' +
    'finding when direct evidence meets the goal’s criteria; remove items that fail review.',
  inputSchema: z.object({
    mutations: z
      .array(mutation)
      .min(1)
      .max(50)
      .describe('Task-state changes to apply together, in order'),
  }),
  execute: async ({ mutations }) => {
    const ledger = await applyLedgerMutations(mutations);
    return { ok: true, ...progress(ledger) };
  },
});
