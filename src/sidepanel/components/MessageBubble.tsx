import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { DisplayMessage } from '../state/conversationStore';
import ToolCallCard from './ToolCallCard';

function ThinkingRow() {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-fg-tertiary">
      <span className="flex gap-[3px]">
        <span className="animate-pulse-dot size-1 rounded-full bg-current [animation-delay:0ms]" />
        <span className="animate-pulse-dot size-1 rounded-full bg-current [animation-delay:180ms]" />
        <span className="animate-pulse-dot size-1 rounded-full bg-current [animation-delay:360ms]" />
      </span>
      Thinking
    </div>
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
  const isUser = message.role === 'user';
  const showThinking = isStreaming && !isUser && !hasText && message.toolCalls.length === 0;

  if (isUser) {
    return (
      <div className="animate-enter flex justify-end">
        <div className="max-w-[85%] rounded-lg border border-accent-line bg-accent-soft px-2.5 py-1.5 text-[13px] break-words whitespace-pre-wrap text-fg">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('animate-enter flex flex-col gap-2', message.toolCalls.length > 0 && 'gap-1.5')}>
      {showThinking && <ThinkingRow />}

      {message.toolCalls.length > 0 && (
        <div className="flex flex-col gap-1">
          {message.toolCalls.map((call) => (
            <ToolCallCard key={call.id} call={call} />
          ))}
        </div>
      )}

      {hasText && (
        <div className="md text-fg">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          {isStreaming && <span className="stream-caret" />}
        </div>
      )}

      {message.error && (
        <div className="rounded-md border border-negative-line bg-negative-soft px-2.5 py-1.5 text-[12px] text-negative">
          {message.error}
        </div>
      )}
    </div>
  );
}
