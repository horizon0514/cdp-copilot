import { useState } from 'react';
import { openImageViewer } from '../lib/openImageViewer';
import ImageLightbox from './ImageLightbox';

function ImageThumb({ src, alt }: { src: string; alt: string }) {
  const [fallbackOpen, setFallbackOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void openImageViewer(src, alt, () => setFallbackOpen(true));
        }}
        className="block w-full overflow-hidden rounded-md border border-line bg-surface text-left outline-none transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent-line"
        aria-label={`Open ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-56 w-full bg-black/20 object-contain object-left"
        />
        <div className="border-t border-line px-2 py-1 text-[10px] text-fg-tertiary">
          Click to view on page
        </div>
      </button>
      {fallbackOpen && (
        <ImageLightbox src={src} alt={alt} onClose={() => setFallbackOpen(false)} />
      )}
    </>
  );
}

/** Screenshots from tool results, shown in the conversation (not buried in tool cards). */
export default function ChatImages({ images, label }: { images: string[]; label?: string }) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {images.map((src, i) => (
        <ImageThumb key={`${i}-${src.slice(0, 32)}`} src={src} alt={label ?? `Screenshot ${i + 1}`} />
      ))}
    </div>
  );
}
