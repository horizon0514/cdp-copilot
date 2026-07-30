import { useEffect, useRef } from 'react';
import { ArrowUpRight, FileText, MousePointer2, TerminalSquare } from 'lucide-react';
import { DisplayMessage } from '../state/conversationStore';
import MessageBubble from './MessageBubble';
import { SectionLabel } from './ui/label';

const SUGGESTIONS = [
  { icon: FileText, text: 'Summarize this page' },
  { icon: MousePointer2, text: 'Click the login button' },
  { icon: TerminalSquare, text: 'What errors are in the console?' },
];

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-1 pb-14">
      <div className="w-full max-w-[280px]">
        <h2 className="text-[13px] font-medium tracking-[-0.015em] text-fg">Ask about this page</h2>
        <p className="mt-1 mb-4 text-[12px] leading-[1.5] text-fg-tertiary">
          Read the DOM, inspect console and network, or drive the page with clicks and typing.
        </p>

        <SectionLabel className="mb-1.5">Suggestions</SectionLabel>
        <div className="flex flex-col gap-1">
          {SUGGESTIONS.map(({ icon: Icon, text }) => (
            <button
              key={text}
              type="button"
              onClick={() => onPick(text)}
              className="group flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-[12px] text-fg-secondary outline-none transition-colors duration-100 hover:border-line-strong hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-line"
            >
              <Icon className="size-3.5 shrink-0 text-fg-tertiary group-hover:text-accent" />
              <span className="truncate">{text}</span>
              <ArrowUpRight className="ml-auto size-3 shrink-0 text-fg-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatThread({
  messages,
  isStreaming,
  onPickSuggestion,
}: {
  messages: DisplayMessage[];
  isStreaming: boolean;
  onPickSuggestion: (text: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Track whether the user has scrolled away; only auto-follow when near bottom.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottom.current = distance < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [messages.length === 0]);

  // Instant scroll while streaming (smooth-per-token feels jumpy); smooth only when settled.
  useEffect(() => {
    if (!stickToBottom.current) return;
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 overflow-y-auto p-3">
        <EmptyState onPick={onPickSuggestion} />
      </div>
    );
  }

  return (
    <div ref={scrollerRef} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-3 py-3.5">
      {messages.map((m, i) => (
        <MessageBubble key={m.id} message={m} isStreaming={isStreaming && i === messages.length - 1} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
