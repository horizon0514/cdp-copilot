import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DisplayToolCall } from '../state/conversationStore';
import { extractImages, redactImages } from '../../lib/images/toolImages';
import { openImageViewer } from '../lib/openImageViewer';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import ImageLightbox from './ImageLightbox';

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const STATUS = {
  running: { variant: 'caution' as const, label: 'Running', pulse: true },
  done: { variant: 'positive' as const, label: 'Done', pulse: false },
  error: { variant: 'negative' as const, label: 'Failed', pulse: false },
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

export default function ToolCallCard({
  call,
  defaultOpen,
}: {
  call: DisplayToolCall;
  /** Override open state. Running/error default open; done defaults closed. */
  defaultOpen?: boolean;
}) {
  const status = STATUS[call.status];
  const initiallyOpen = defaultOpen ?? call.status !== 'done';
  const [open, setOpen] = useState(initiallyOpen);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const images = call.status === 'done' ? extractImages(call.result) : [];

  // Running → done should collapse; failures stay open. defaultOpen wins when set.
  useEffect(() => {
    if (defaultOpen != null) {
      setOpen(defaultOpen);
      return;
    }
    setOpen(call.status !== 'done');
  }, [call.status, defaultOpen]);

  return (
    <>
      <details
        className="group w-full overflow-hidden rounded-md border border-line bg-surface"
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 px-2 select-none hover:bg-surface-hover">
          <ChevronRight className="size-3 shrink-0 text-fg-tertiary transition-transform duration-100 group-open:rotate-90" />
          <code className="truncate font-mono text-[11.5px] text-fg-secondary group-hover:text-fg">
            {call.name}
          </code>
          {images.length > 0 && (
            <span className="text-[10px] text-fg-tertiary">{images.length} img</span>
          )}
          <Badge variant={status.variant} className="ml-auto">
            <span
              className={cn('size-1 rounded-full bg-current', status.pulse && 'animate-pulse-dot')}
            />
            {status.label}
          </Badge>
        </summary>

        <div className="space-y-2 border-t border-line px-2.5 py-2 pl-[26px]">
          <Block label="Arguments" body={stringify(call.args)} />
          {images.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] font-medium tracking-[0.06em] text-fg-tertiary uppercase">
                Preview
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
            <Block label="Result" body={stringify(redactImages(call.result))} />
          )}
          {call.status === 'error' && (
            <Block label="Error" body={call.error ?? ''} tone="negative" />
          )}
        </div>
      </details>
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={call.name}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}
