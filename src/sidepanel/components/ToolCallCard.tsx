import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DisplayToolCall } from '../state/conversationStore';
import { extractImages, redactImages } from '../../lib/images/toolImages';
import { openImageViewer } from '../lib/openImageViewer';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { useT } from '../i18n/useT';
import type { MessageKey } from '../../lib/i18n';
import ImageLightbox from './ImageLightbox';

/** Collapse a just-finished tool after a short beat so the result is glanceable. */
export const TOOL_COLLAPSE_DELAY_MS = 650;

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const STATUS: Record<
  DisplayToolCall['status'],
  { variant: 'caution' | 'positive' | 'negative' | 'neutral'; labelKey: MessageKey; pulse: boolean }
> = {
  running: { variant: 'caution', labelKey: 'tools.running', pulse: true },
  done: { variant: 'positive', labelKey: 'tools.done', pulse: false },
  error: { variant: 'negative', labelKey: 'tools.failed', pulse: false },
  aborted: { variant: 'neutral', labelKey: 'tools.stopped', pulse: false },
};

function Block({ label, body, tone }: { label: string; body: string; tone?: 'negative' }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium tracking-[0.06em] text-fg-tertiary uppercase">{label}</div>
      <pre
        className={cn(
          'overflow-x-auto font-mono text-[11px] leading-[1.55] break-words whitespace-pre-wrap',
          tone === 'negative' ? 'text-negative' : 'text-fg-secondary',
        )}
      >
        {body}
      </pre>
    </div>
  );
}

export default function ToolCallCard({ call }: { call: DisplayToolCall }) {
  const t = useT();
  const status = STATUS[call.status];
  const [open, setOpen] = useState(call.status !== 'done');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const userToggled = useRef(false);
  const prevStatus = useRef(call.status);
  const images = call.status === 'done' ? extractImages(call.result) : [];

  // Auto open/close from status only when the user hasn't taken over.
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = call.status;

    if (userToggled.current) return;

    if (call.status === 'running' || call.status === 'error') {
      setOpen(true);
      return;
    }

    // running/error → done: keep open briefly, then fold.
    if (call.status === 'done' && prev !== 'done') {
      setOpen(true);
      const timer = setTimeout(() => {
        if (!userToggled.current) setOpen(false);
      }, TOOL_COLLAPSE_DELAY_MS);
      return () => clearTimeout(timer);
    }

    if (call.status === 'done' && prev === 'done') {
      // Already done on mount (e.g. hydrated history) — stay collapsed.
      setOpen(false);
    }
  }, [call.status]);

  return (
    <>
      <details
        className="group w-full overflow-hidden rounded-lg border border-line bg-surface"
        open={open}
        onToggle={(e) => {
          if (e.target !== e.currentTarget) return;
          userToggled.current = true;
          setOpen((e.currentTarget as HTMLDetailsElement).open);
        }}
      >
        <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 px-2 select-none transition-colors duration-150 hover:bg-surface-hover">
          <ChevronRight className="size-3 shrink-0 text-fg-tertiary transition-transform duration-200 group-open:rotate-90" />
          <code className="truncate font-mono text-[11.5px] text-fg-secondary group-hover:text-fg">
            {call.name}
          </code>
          {images.length > 0 && (
            <span className="text-[10px] text-fg-tertiary">
              {t('tools.images', { count: images.length })}
            </span>
          )}
          <Badge variant={status.variant} className="ml-auto">
            <span
              className={cn('size-1 rounded-full bg-current', status.pulse && 'animate-pulse-dot')}
            />
            {t(status.labelKey)}
          </Badge>
        </summary>

        <div className="space-y-2 border-t border-line px-2.5 py-2 pl-[26px]">
          <Block label={t('tools.arguments')} body={stringify(call.args)} />
          {images.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] font-medium tracking-[0.06em] text-fg-tertiary uppercase">
                {t('tools.preview')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {images.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      void openImageViewer(src, call.name, () => setLightboxSrc(src));
                    }}
                    className="overflow-hidden rounded border border-line outline-none hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent-line"
                  >
                    <img
                      src={src}
                      alt={`${call.name} result ${i + 1}`}
                      className="max-h-24 max-w-[140px] object-contain"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {call.status === 'done' && (
            <Block label={t('tools.result')} body={stringify(redactImages(call.result))} />
          )}
          {call.status === 'error' && (
            <Block label={t('tools.error')} body={call.error ?? ''} tone="negative" />
          )}
          {call.status === 'aborted' && (
            <Block label={t('tools.result')} body={t('tools.stoppedBeforeResult')} />
          )}
        </div>
      </details>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt={call.name} onClose={() => setLightboxSrc(null)} />
      )}
    </>
  );
}
