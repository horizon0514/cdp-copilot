import { useDeferredValue } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowRight, RotateCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { stabilizeStreamingMarkdown } from '../lib/stabilizeStreamingMarkdown';
import { imagesFromToolCalls } from '../../lib/images/toolImages';
import { DisplayMessage } from '../state/conversationStore';
import { useI18n, useT } from '../i18n/useT';
import ChatImages from './ChatImages';
import ToolCallList from './ToolCallList';

function ThinkingRow() {
  const t = useT();
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-fg-tertiary" aria-live="polite">
      <span className="flex gap-[3px]" aria-hidden>
        <span className="animate-pulse-dot size-1 rounded-full bg-current [animation-delay:0ms]" />
        <span className="animate-pulse-dot size-1 rounded-full bg-current [animation-delay:180ms]" />
        <span className="animate-pulse-dot size-1 rounded-full bg-current [animation-delay:360ms]" />
      </span>
      {t('message.thinking')}
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
  const { t, tp, locale } = useI18n();
  const reason = stop.aborted
    ? t('message.stop.aborted')
    : stop.hitStepLimit
      ? t('message.stop.stepLimit', { steps: stop.steps })
      : stop.finishReason === 'length'
        ? t('message.stop.length')
        : stop.finishReason === 'content-filter'
          ? t('message.stop.contentFilter')
          : !hasText
            ? t('message.stop.noAnswer')
            : t('message.stop.early', { reason: stop.finishReason });

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-tertiary">
      <span className="text-caution">{reason}</span>
      <span className="tabular-nums">
        {tp('message.steps', stop.steps)}
        {stop.totalTokens != null &&
          ` · ${t('message.tokens', { count: stop.totalTokens.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en') })}`}
      </span>
    </div>
  );
}

/**
 * Always render GFM. While streaming, close open fences so incomplete ```
 * blocks don't thrash the layout, and defer the markdown parse so React can
 * skip intermediate tokens under load.
 */
function AssistantText({ text, streaming }: { text: string; streaming: boolean }) {
  const source = streaming ? stabilizeStreamingMarkdown(text) : text;
  const deferred = useDeferredValue(source);
  const rendered = streaming ? deferred : source;

  return (
    <div className="md text-fg">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{rendered}</ReactMarkdown>
      {streaming && <span className="stream-caret" />}
    </div>
  );
}

export default function MessageBubble({
  message,
  isStreaming,
  onContinue,
  onRetry,
}: {
  message: DisplayMessage;
  isStreaming?: boolean;
  /** Present only on the last message, once the turn has settled. */
  onContinue?: () => void;
  onRetry?: () => void;
}) {
  const t = useT();
  const hasText = message.text.trim().length > 0;
  const isUser = message.role === 'user';
  const chatImages = isUser ? [] : imagesFromToolCalls(message.toolCalls);
  const showThinking =
    isStreaming && !isUser && !hasText && message.toolCalls.length === 0 && chatImages.length === 0;
  const showContinue = Boolean(onContinue) && !isStreaming && message.stop?.hitStepLimit === true;
  const showRetry = Boolean(onRetry) && !isStreaming && Boolean(message.error);

  if (isUser) {
    return (
      <div className="animate-enter flex justify-end">
        <div className="max-w-[85%] rounded-xl border border-accent-line bg-accent-soft px-3 py-2 text-[13px] leading-[1.5] break-words whitespace-pre-wrap text-fg shadow-[0_1px_0_rgba(37,99,235,0.06)]">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('animate-enter flex flex-col gap-2', message.toolCalls.length > 0 && 'gap-1.5')}
      data-role="assistant"
    >
      {showThinking && <ThinkingRow />}

      {message.toolCalls.length > 0 && <ToolCallList calls={message.toolCalls} />}

      {/* Screenshots live in the transcript so they stay visible after tools collapse. */}
      <ChatImages images={chatImages} label={t('message.screenshot')} />

      {hasText && <AssistantText text={message.text} streaming={Boolean(isStreaming)} />}

      {message.error && (
        <div
          role="alert"
          className="rounded-lg border border-negative-line bg-negative-soft px-2.5 py-2 text-[12px] leading-[1.45] text-negative"
        >
          {message.error}
        </div>
      )}

      {message.stop &&
        !isStreaming &&
        (message.stop.hitStepLimit || message.stop.finishReason !== 'stop' || !hasText) && (
          <StopNote stop={message.stop} hasText={hasText} />
        )}

      {/* The two dead ends worth a button: it wanted more steps, or it failed
          outright. Both were previously "retype it yourself". */}
      {(showContinue || showRetry) && (
        <div className="flex flex-wrap gap-1.5">
          {showContinue && (
            <Button type="button" size="sm" variant="outline" onClick={onContinue}>
              <ArrowRight className="size-3" />
              {t('message.continue')}
            </Button>
          )}
          {showRetry && (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RotateCw className="size-3" />
              {t('message.retry')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
