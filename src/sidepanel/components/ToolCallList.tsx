import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DisplayToolCall } from '../state/conversationStore';
import ToolCallCard from './ToolCallCard';
import { Badge } from './ui/badge';
import { useT } from '../i18n/useT';

/** Wait before folding a finished tool into the compact "N tools" group. */
export const TOOL_GROUP_DELAY_MS = 1000;

type Group =
  | { kind: 'single'; call: DisplayToolCall }
  | { kind: 'successes'; calls: DisplayToolCall[] };

/**
 * Claude Code–style grouping: consecutive *settled* successes collapse;
 * running / errors / freshly-finished tools stay as their own rows.
 */
export function groupToolCalls(
  calls: DisplayToolCall[],
  settledIds: ReadonlySet<string> = new Set(),
): Group[] {
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
    if (call.status === 'done' && settledIds.has(call.id)) {
      pending.push(call);
      continue;
    }
    flush();
    groups.push({ kind: 'single', call });
  }
  flush();
  return groups;
}

/** After a tool has been `done` for TOOL_GROUP_DELAY_MS, mark it settled for grouping.
 * Tools that arrive already-done (hydrated history) settle immediately — no delayed jump.
 */
function useSettledDoneIds(calls: DisplayToolCall[]): ReadonlySet<string> {
  const [settled, setSettled] = useState<Set<string>>(() => new Set());
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Ids we observed while running/error — only those get a collapse delay. */
  const watchedLive = useRef(new Set<string>());

  useEffect(() => {
    const alive = new Set(calls.map((c) => c.id));

    for (const [id, timer] of timers.current) {
      if (!alive.has(id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }
    for (const id of [...watchedLive.current]) {
      if (!alive.has(id)) watchedLive.current.delete(id);
    }

    setSettled((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (alive.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });

    for (const call of calls) {
      if (call.status === 'running' || call.status === 'error') {
        watchedLive.current.add(call.id);
        const timer = timers.current.get(call.id);
        if (timer) {
          clearTimeout(timer);
          timers.current.delete(call.id);
        }
        setSettled((prev) => {
          if (!prev.has(call.id)) return prev;
          const next = new Set(prev);
          next.delete(call.id);
          return next;
        });
        continue;
      }

      if (call.status !== 'done') continue;
      if (settledRef.current.has(call.id)) continue;

      // History / already-done on first sight → settle immediately.
      if (!watchedLive.current.has(call.id)) {
        setSettled((prev) => {
          if (prev.has(call.id)) return prev;
          const next = new Set(prev);
          next.add(call.id);
          return next;
        });
        continue;
      }

      if (timers.current.has(call.id)) continue;

      const timer = setTimeout(() => {
        timers.current.delete(call.id);
        setSettled((prev) => {
          if (prev.has(call.id)) return prev;
          const next = new Set(prev);
          next.add(call.id);
          return next;
        });
      }, TOOL_GROUP_DELAY_MS);
      timers.current.set(call.id, timer);
    }
  }, [calls]);

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  return settled;
}

function SuccessGroup({ calls }: { calls: DisplayToolCall[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const names = calls.map((c) => c.name).join(', ');

  return (
    <details
      className="group w-full overflow-hidden rounded-lg border border-line bg-surface"
      open={open}
      onToggle={(e) => {
        // Nested <details> toggle events bubble — ignore children or the whole
        // SuccessGroup collapses when an inner tool row is closed.
        if (e.target !== e.currentTarget) return;
        setOpen((e.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 px-2 select-none transition-colors duration-150 hover:bg-surface-hover">
        <ChevronRight className="size-3 shrink-0 text-fg-tertiary transition-transform duration-200 group-open:rotate-90" />
        <span className="truncate text-[11.5px] text-fg-secondary group-hover:text-fg" title={names}>
          {t('tools.count', { count: calls.length })}
        </span>
        <Badge variant="positive" className="ml-auto">
          <span className="size-1 rounded-full bg-current" />
          {t('tools.done')}
        </Badge>
      </summary>
      <div className="flex flex-col gap-1 border-t border-line p-1.5">
        {calls.map((call) => (
          // Nested rows are independent — don't force-collapse on parent re-renders.
          <ToolCallCard key={call.id} call={call} />
        ))}
      </div>
    </details>
  );
}

export default function ToolCallList({ calls }: { calls: DisplayToolCall[] }) {
  const settledIds = useSettledDoneIds(calls);
  const groups = groupToolCalls(calls, settledIds);

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => {
        if (group.kind === 'successes') {
          // Stable key: first id stays put as later tools join, so expanding the
          // group isn't wiped by a remount when the member list grows.
          return <SuccessGroup key={`g-${group.calls[0].id}`} calls={group.calls} />;
        }
        const { call } = group;
        return <ToolCallCard key={call.id} call={call} />;
      })}
    </div>
  );
}
