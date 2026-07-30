import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DisplayToolCall } from '../state/conversationStore';
import ToolCallCard from './ToolCallCard';
import { Badge } from './ui/badge';

type Group =
  | { kind: 'single'; call: DisplayToolCall }
  | { kind: 'successes'; calls: DisplayToolCall[] };

/** Claude Code–style grouping: consecutive successes collapse; running/errors stay visible. */
export function groupToolCalls(calls: DisplayToolCall[]): Group[] {
  const groups: Group[] = [];
  let pending: DisplayToolCall[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    if (pending.length === 1) {
      groups.push({ kind: 'single', call: pending[0] });
    } else {
      groups.push({ kind: 'successes', calls: pending });
    }
    pending = [];
  };

  for (const call of calls) {
    if (call.status === 'done') {
      pending.push(call);
      continue;
    }
    flush();
    groups.push({ kind: 'single', call });
  }
  flush();
  return groups;
}

function SuccessGroup({ calls }: { calls: DisplayToolCall[] }) {
  const [open, setOpen] = useState(false);
  const names = calls.map((c) => c.name).join(', ');

  return (
    <details
      className="group w-full overflow-hidden rounded-md border border-line bg-surface"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 px-2 select-none hover:bg-surface-hover">
        <ChevronRight className="size-3 shrink-0 text-fg-tertiary transition-transform duration-100 group-open:rotate-90" />
        <span className="truncate text-[11.5px] text-fg-secondary group-hover:text-fg" title={names}>
          {calls.length} tools
        </span>
        <Badge variant="positive" className="ml-auto">
          <span className="size-1 rounded-full bg-current" />
          Done
        </Badge>
      </summary>
      <div className="flex flex-col gap-1 border-t border-line p-1.5">
        {calls.map((call) => (
          <ToolCallCard key={call.id} call={call} defaultOpen={false} />
        ))}
      </div>
    </details>
  );
}

export default function ToolCallList({ calls }: { calls: DisplayToolCall[] }) {
  const groups = groupToolCalls(calls);

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => {
        if (group.kind === 'successes') {
          return <SuccessGroup key={group.calls.map((c) => c.id).join('-')} calls={group.calls} />;
        }
        const { call } = group;
        return (
          <ToolCallCard
            key={call.id}
            call={call}
            defaultOpen={call.status === 'running' || call.status === 'error'}
          />
        );
      })}
    </div>
  );
}
