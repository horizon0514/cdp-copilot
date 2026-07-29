import { ChevronRight, Loader2, Check, X } from 'lucide-react';
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

const STATUS_CONFIG = {
  running: { variant: 'warning' as const, icon: Loader2, label: 'Running', spin: true },
  done: { variant: 'success' as const, icon: Check, label: 'Done', spin: false },
  error: { variant: 'destructive' as const, icon: X, label: 'Error', spin: false },
};

export default function ToolCallCard({ call }: { call: DisplayToolCall }) {
  const status = STATUS_CONFIG[call.status];
  const StatusIcon = status.icon;

  return (
    <details className="group w-full max-w-[88%] overflow-hidden rounded-md border border-border bg-muted/60">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 select-none">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <code className="truncate font-mono text-[11.5px]">{call.name}</code>
        <Badge variant={status.variant} className="ml-auto">
          <StatusIcon className={cn('size-2.5', status.spin && 'animate-spin')} />
          {status.label}
        </Badge>
      </summary>
      <div className="space-y-1.5 px-2.5 pb-2 pl-7">
        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
          {stringify(call.args)}
        </pre>
        {call.status === 'done' && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
            {stringify(call.result)}
          </pre>
        )}
        {call.status === 'error' && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-destructive">
            {call.error}
          </pre>
        )}
      </div>
    </details>
  );
}
