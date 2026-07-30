import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Minus, Plus, X, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

function downloadImage(src: string, alt: string) {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);/i.exec(src);
  const ext = (match?.[1] ?? 'png').toLowerCase().replace('jpeg', 'jpg');
  const safe = (alt || 'screenshot').replace(/[^\w.-]+/g, '_').slice(0, 60);
  const a = document.createElement('a');
  a.href = src;
  a.download = `${safe || 'screenshot'}.${ext}`;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}

export default function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
      if (e.key === '-' || e.key === '_') setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
      if (e.key === '0') {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll while open (side panel is short; still nice).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const bump = (delta: number) =>
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const dragMoved = useRef(false);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div
        className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate px-1 text-[12px] text-white/70">{alt}</span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Zoom out"
            onClick={() => bump(-ZOOM_STEP)}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-12 text-center tabular-nums text-[11px] text-white/70">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Zoom in"
            onClick={() => bump(ZOOM_STEP)}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Reset zoom"
            onClick={reset}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Download"
            onClick={() => downloadImage(src, alt)}
          >
            <ArrowDownToLine className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden',
          zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (dragMoved.current) {
            dragMoved.current = false;
            return;
          }
          // Dimmed backdrop closes; the image itself does not.
          if ((e.target as HTMLElement).closest('img')) return;
          onClose();
        }}
        onWheel={(e) => {
          e.preventDefault();
          bump(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        }}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragMoved.current = false;
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          if (
            Math.abs(e.clientX - drag.current.x) > 3 ||
            Math.abs(e.clientY - drag.current.y) > 3
          ) {
            dragMoved.current = true;
          }
          setOffset({
            x: drag.current.ox + (e.clientX - drag.current.x),
            y: drag.current.oy + (e.clientY - drag.current.y),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div className="flex h-full w-full items-center justify-center p-3">
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain transition-transform duration-75"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="shrink-0 px-3 py-1.5 text-center text-[10px] text-white/45">
        Scroll to zoom · drag to pan · Esc to close
      </div>
    </div>,
    document.body,
  );
}
