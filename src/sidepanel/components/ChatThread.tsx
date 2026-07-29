import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { DisplayMessage } from '../state/conversationStore';
import MessageBubble from './MessageBubble';

export default function ChatThread({
  messages,
  isStreaming,
}: {
  messages: DisplayMessage[];
  isStreaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-3">
      {messages.length === 0 && (
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-2 px-5 py-6 text-center text-muted-foreground">
          <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Sparkles className="size-5" />
          </div>
          <p className="text-[12.5px]">
            Ask me to read this page or automate it — e.g. "what's on this page?" or "click the login button".
          </p>
        </div>
      )}
      {messages.map((m, i) => (
        <MessageBubble key={m.id} message={m} isStreaming={isStreaming && i === messages.length - 1} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
