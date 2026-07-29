import { ChevronRight } from 'lucide-react';
import { DisplayToolCall } from '../state/conversationStore';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const STATUS = {
  running: { variant: 'caution' as const, label: 'Running', pulse: true },
  done: { variant: 'positive' as const, label: 'Done', pulse: false },
  error: { variant: 'negative' as const, label: 'Failed', pulse: false },
};

function Block({ label, body, tone }: { label: string; body: string; tone?: 'negative' }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium tracking-[0.06em] text-fg-tertiary uppercase">{label}</div>
      <pre
        className={cn(
          'overflow-x-auto font-mono text-[11px] leading-[1.55] whitespace-pre-wrap break-words',
          tone === 'negative' ? 'text-negative' : 'text-fg-secondary',
        )}
      >
        {body}
      </pre>
    </div>
  );
}

export default function ToolCallCard({ call }: { call: DisplayToolCall }) {
  const status = STATUS[call.status];

  return (
    <details className="group w-full overflow-hidden rounded-md border border-line bg-surface">
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 px-2 select-none hover:bg-surface-hover">
        <ChevronRight className="size-3 shrink-0 text-fg-tertiary transition-transform duration-100 group-open:rotate-90" />
        <code className="truncate font-mono text-[11.5px] text-fg-secondary group-hover:text-fg">
          {call.name}
        </code>
        <Badge variant={status.variant} className="ml-auto">
          <span
            className={cn(
              'size-1 rounded-full bg-current',
              status.pulse && 'animate-pulse-dot',
            )}
          />
          {status.label}
        </Badge>
      </summary>

      <div className="space-y-2 border-t border-line px-2.5 py-2 pl-[26px]">
        <Block label="Arguments" body={stringify(call.args)} />
        {call.status === 'done' && <Block label="Result" body={stringify(call.result)} />}
        {call.status === 'error' && <Block label="Error" body={call.error ?? ''} tone="negative" />}
      </div>
    </details>
  );
}
