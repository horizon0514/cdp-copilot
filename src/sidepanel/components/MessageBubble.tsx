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

/** Only shown when the turn ended for a reason the user wouldn't infer from the
 * transcript — a clean 'stop' with a real answer needs no explanation. */
function StopNote({
  stop,
  hasText,
}: {
  stop: NonNullable<DisplayMessage['stop']>;
  hasText: boolean;
}) {
  const reason = stop.hitStepLimit
    ? `Hit the ${stop.steps}-step limit — the model was still working. Ask it to continue, or narrow the task.`
    : stop.finishReason === 'length'
      ? 'The model hit its output token limit mid-response.'
      : stop.finishReason === 'content-filter'
        ? 'The provider blocked the response (content filter).'
        : !hasText
          ? 'The model ran tools but returned no answer. Often means the context filled up — try a narrower ask.'
          : `Model stopped early (finishReason: ${stop.finishReason}).`;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-tertiary">
      <span className="text-caution">{reason}</span>
      <span className="tabular-nums">
        {stop.steps} step{stop.steps === 1 ? '' : 's'}
        {stop.totalTokens != null && ` · ${stop.totalTokens.toLocaleString()} tokens`}
      </span>
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

      {message.stop &&
        !isStreaming &&
        (message.stop.hitStepLimit || message.stop.finishReason !== 'stop' || !hasText) && (
          <StopNote stop={message.stop} hasText={hasText} />
        )}
    </div>
  );
}
