import { tool } from 'ai';
import { z } from 'zod';
import { applyPlanUpdate, recordFinding, recordNote } from '../ledger/activeLedger';
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

export const update_plan = tool({
  description:
    'Records or revises the durable task plan. Use at the start of any multi-step task (set the goal ' +
    'and a short step list), and again whenever a step finishes or the plan changes — pass the FULL ' +
    'plan list each time, it replaces the previous one. The current plan is shown in your instructions ' +
    'each step and survives conversation trimming.',
  inputSchema: z.object({
    goal: z
      .string()
      .optional()
      .describe('The overall task goal, restated compactly (include the success criterion, e.g. a target count)'),
    plan: z
      .array(
        z.object({
          text: z.string().describe('One short step'),
          status: z.enum(['pending', 'in_progress', 'done', 'skipped']).optional(),
        }),
      )
      .optional()
      .describe('The full plan list — replaces the previous plan entirely'),
  }),
  execute: async ({ goal, plan }) => {
    const ledger = await applyPlanUpdate({ goal, plan });
    return { ok: true, ...progress(ledger) };
  },
});

export const save_finding = tool({
  description:
    'Saves one result the task is looking for (an account, a product, a fact…) to durable storage. ' +
    'Call it IMMEDIATELY each time you discover something the task asked for — never keep results only ' +
    'in prose, they are lost when the conversation is trimmed. Saving an existing key updates that entry.',
  inputSchema: z.object({
    key: z
      .string()
      .describe('Stable dedup key for this result — an account id, username, URL, etc.'),
    summary: z.string().describe('One-line human-readable summary of the result and the evidence for it'),
    data: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Optional structured fields worth keeping verbatim (profile URL, quoted comment, …)'),
  }),
  execute: async ({ key, summary, data }) => {
    const { ledger, isNew, dataDropped } = await recordFinding({ key, summary, data });
    return {
      saved: true,
      isNew,
      findingsSaved: ledger.findings.length,
      ...(dataDropped ? { warning: 'data exceeded 2000 chars and was dropped — keep it compact' } : {}),
    };
  },
});

export const add_note = tool({
  description:
    'Leaves a short durable handoff note to your future self about where you left off — e.g. which page ' +
    'or list position you reached, what to try next, or a dead end to avoid. Use before long detours and ' +
    'whenever you finish a work chunk; the newest notes are shown in your instructions each step.',
  inputSchema: z.object({
    text: z.string().describe('The note, one or two sentences'),
  }),
  execute: async ({ text }) => {
    await recordNote(text);
    return { ok: true };
  },
});
