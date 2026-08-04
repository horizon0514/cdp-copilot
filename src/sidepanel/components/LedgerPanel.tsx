import { useEffect, useState } from 'react';
import { Check, ChevronDown, ClipboardList, Copy } from 'lucide-react';
import { isLedgerEmpty, type Finding, type PlanItem, type TaskLedger } from '../../lib/ledger/types';
import { useT } from '../i18n/useT';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const STATUS_MARK: Record<PlanItem['status'], string> = {
  pending: '○',
  in_progress: '●',
  done: '✓',
  skipped: '—',
};

function mdCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** The exportable deliverable: findings as a Markdown table. */
export function findingsMarkdown(findings: Finding[]): string {
  const hasData = findings.some((f) => f.data !== undefined);
  const header = hasData ? '| # | Key | Summary | Data |' : '| # | Key | Summary |';
  const divider = hasData ? '| --- | --- | --- | --- |' : '| --- | --- | --- |';
  const rows = findings.map((f, i) => {
    const cells = [String(i + 1), mdCell(f.key), mdCell(f.summary)];
    if (hasData) cells.push(f.data !== undefined ? mdCell(JSON.stringify(f.data)) : '');
    return `| ${cells.join(' | ')} |`;
  });
  return [header, divider, ...rows].join('\n');
}

/**
 * Renders the durable task ledger the agent maintains via update_plan /
 * save_finding / add_note — the user-facing answer to "what has it actually
 * got so far", independent of what the transcript says.
 */
export default function LedgerPanel({ ledger }: { ledger: TaskLedger | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!ledger || isLedgerEmpty(ledger)) return null;

  const planDone = ledger.plan.filter((p) => p.status === 'done' || p.status === 'skipped').length;

  const copyFindings = async () => {
    await navigator.clipboard.writeText(findingsMarkdown(ledger.findings));
    setCopied(true);
  };

  return (
    <div className="shrink-0 border-b border-line bg-bg text-[11px]">
      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 overflow-hidden px-3 text-left hover:bg-surface"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t('ledger.collapse') : t('ledger.expand')}
      >
        <ClipboardList className="size-3 shrink-0 text-fg-tertiary" aria-hidden />
        <span className="min-w-0 truncate font-medium text-fg-secondary">
          {ledger.goal ?? t('ledger.title')}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {ledger.plan.length > 0 && (
            <Badge variant="neutral">
              {t('ledger.planProgress', { done: planDone, total: ledger.plan.length })}
            </Badge>
          )}
          {ledger.findings.length > 0 && (
            <Badge variant="positive">
              {t('ledger.findingsCount', { count: ledger.findings.length })}
            </Badge>
          )}
          <ChevronDown
            className={cn('size-3 text-fg-tertiary transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-line px-3 py-2 leading-[1.5]">
          {ledger.plan.length > 0 && (
            <section className="mb-2">
              <h3 className="mb-1 font-semibold text-fg-tertiary uppercase tracking-wide text-[10px]">
                {t('ledger.plan')}
              </h3>
              <ol className="space-y-0.5">
                {ledger.plan.map((item, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex gap-1.5',
                      item.status === 'done' || item.status === 'skipped'
                        ? 'text-fg-tertiary line-through'
                        : 'text-fg-secondary',
                      item.status === 'in_progress' && 'font-medium text-fg',
                    )}
                  >
                    <span className="shrink-0" aria-hidden>
                      {STATUS_MARK[item.status]}
                    </span>
                    <span className="min-w-0">{item.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {ledger.findings.length > 0 && (
            <section className="mb-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-fg-tertiary uppercase tracking-wide text-[10px]">
                  {t('ledger.findings')}
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-5 gap-1 px-1.5 text-[10px]"
                  onClick={() => void copyFindings()}
                  title={t('ledger.copy')}
                >
                  {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                  {copied ? t('ledger.copied') : t('ledger.copy')}
                </Button>
              </div>
              <ul className="space-y-0.5">
                {ledger.findings.map((f) => (
                  <li key={f.key} className="flex gap-1.5 text-fg-secondary">
                    <span className="shrink-0 font-medium text-fg">{f.key}</span>
                    <span className="min-w-0">{f.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ledger.notes.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold text-fg-tertiary uppercase tracking-wide text-[10px]">
                {t('ledger.notes')}
              </h3>
              <ul className="space-y-0.5 text-fg-tertiary">
                {ledger.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
