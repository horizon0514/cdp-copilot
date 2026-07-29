import { useEffect, useRef } from 'react';
import { DisplayMessage } from '../state/conversationStore';
import MessageBubble from './MessageBubble';

export default function ChatThread({ messages }: { messages: DisplayMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-thread">
      {messages.length === 0 && (
        <div className="message-bubble assistant">
          Ask me to read this page or automate it — e.g. "what's on this page?" or "click the login button".
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
