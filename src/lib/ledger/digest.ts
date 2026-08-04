import { isLedgerEmpty, type Finding, type PlanItem, type TaskLedger } from './types';

/** How many of the newest findings the digest spells out; the rest are counted. */
const DIGEST_FINDINGS = 15;
const DIGEST_NOTES = 3;
const DIGEST_LINE_CHARS = 200;

function clampLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > DIGEST_LINE_CHARS ? `${flat.slice(0, DIGEST_LINE_CHARS)}…` : flat;
}

function planLine(item: PlanItem, index: number): string {
  return `${index + 1}. [${item.status}] ${clampLine(item.text)}`;
}

function findingLines(finding: Finding): string[] {
  const lines = [`- ${clampLine(finding.key)}: ${clampLine(finding.summary)}`];
  if (finding.evidence) lines.push(`  Evidence: ${clampLine(finding.evidence)}`);
  if (finding.rationale) lines.push(`  Qualification: ${clampLine(finding.rationale)}`);
  return lines;
}

/**
 * The compact, model-facing view of the ledger, re-injected into the
 * instructions on every step. This is what makes findings durable: the
 * conversation can lose the step where a finding was recorded and the model
 * still sees the result here.
 */
export function formatLedgerDigest(ledger: TaskLedger): string | null {
  if (isLedgerEmpty(ledger)) return null;

  const lines: string[] = [
    '## Task ledger (durable memory — survives conversation trimming)',
  ];

  if (ledger.goal) {
    lines.push(`Goal: ${clampLine(ledger.goal)}`);
  }

  if (ledger.plan.length > 0) {
    const done = ledger.plan.filter((p) => p.status === 'done' || p.status === 'skipped').length;
    lines.push(`Plan (${done}/${ledger.plan.length} done):`);
    lines.push(...ledger.plan.map(planLine));
  }

  if (ledger.findings.length > 0) {
    const shown = ledger.findings.slice(-DIGEST_FINDINGS);
    const hidden = ledger.findings.length - shown.length;
    lines.push(
      hidden > 0
        ? `Findings (${ledger.findings.length} saved; newest ${shown.length} shown, ${hidden} older omitted):`
        : `Findings (${ledger.findings.length} saved):`,
    );
    lines.push(...shown.flatMap(findingLines));
  }

  if (ledger.notes.length > 0) {
    lines.push('Handoff notes (newest last):');
    lines.push(...ledger.notes.slice(-DIGEST_NOTES).map((n) => `- ${clampLine(n)}`));
  }

  lines.push(
    'Treat this ledger — not the conversation — as the source of truth for progress. ' +
      'Keep it current with update_task_ledger.',
  );

  return lines.join('\n');
}
