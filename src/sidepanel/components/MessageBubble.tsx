import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { DisplayMessage } from '../state/conversationStore';
import ToolCallCard from './ToolCallCard';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" aria-label="Thinking">
      <span className="typing-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:0s]" />
      <span className="typing-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:0.15s]" />
      <span className="typing-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:0.3s]" />
    </span>
  );
}

export default function MessageBubble({
  message,
  isStreaming,
}: {
  message: DisplayMessage;
  isStreaming?: boolean;
}) {
  const hasText = message.text.trim().length > 0;
  const showTyping = isStreaming && message.role === 'assistant' && !hasText && message.toolCalls.length === 0;
  const showBubble = message.role === 'user' || hasText || showTyping;
  const isUser = message.role === 'user';

  return (
    <div className={cn('animate-message-in flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      {showBubble && (
        <div
          className={cn(
            'max-w-[88%] rounded-lg px-3 py-2 text-[13px] shadow-sm',
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground whitespace-pre-wrap break-words'
              : 'rounded-bl-sm border border-border bg-card',
          )}
        >
          {showTyping ? (
            <TypingDots />
          ) : isUser ? (
            message.text
          ) : (
            <div className="prose-chat prose prose-sm dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
              {isStreaming && hasText && <span className="typing-cursor" />}
            </div>
          )}
        </div>
      )}
      {message.toolCalls.map((call) => (
        <ToolCallCard key={call.id} call={call} />
      ))}
      {message.error && (
        <div className="w-full max-w-[88%] rounded-md border border-destructive-border bg-destructive-bg px-3 py-2 text-xs text-destructive">
          {message.error}
        </div>
      )}
    </div>
  );
}
