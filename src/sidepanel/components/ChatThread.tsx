import { useEffect, useRef } from 'react';
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
    <div className="chat-thread">
      {messages.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✦</div>
          <p>Ask me to read this page or automate it — e.g. "what's on this page?" or "click the login button".</p>
        </div>
      )}
      {messages.map((m, i) => (
        <MessageBubble key={m.id} message={m} isStreaming={isStreaming && i === messages.length - 1} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
