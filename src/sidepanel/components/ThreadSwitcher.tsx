import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { ThreadSummary } from '../state/conversationStore';

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ThreadSwitcher({
  threadId,
  threadList,
  isStreaming,
  onNewChat,
  onSwitch,
}: {
  threadId: string;
  threadList: ThreadSummary[];
  isStreaming: boolean;
  onNewChat: () => void;
  onSwitch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = threadList.find((t) => t.id === threadId);
  const title = current?.title ?? 'New chat';

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-1">
      <button
        type="button"
        disabled={isStreaming}
        onClick={() => setOpen((v) => !v)}
        className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-[12px] text-fg-secondary outline-none hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-line disabled:opacity-40"
        aria-label="Chat history"
        aria-expanded={open}
      >
        {title}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isStreaming}
        aria-label="New chat"
        onClick={() => {
          setOpen(false);
          onNewChat();
        }}
      >
        <MessageSquarePlus className="size-3.5" />
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close chat history"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-1 max-h-64 w-[min(100%,280px)] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg">
            {threadList.length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-fg-tertiary">No chats yet</div>
            ) : (
              threadList.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSwitch(t.id);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] outline-none hover:bg-surface-hover',
                    t.id === threadId && 'bg-surface-active',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-fg">{t.title}</span>
                  <span className="shrink-0 text-[10px] text-fg-tertiary">{formatWhen(t.updatedAt)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
