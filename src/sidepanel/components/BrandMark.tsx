import type { ImgHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

function iconUrl(size: 16 | 32 | 48 | 128 = 32): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`icons/icon${size}.png`);
    }
  } catch {
    // Vitest / non-extension contexts fall through.
  }
  return `/icons/icon${size}.png`;
}

/** Circular Pagehand mark — same asset as the toolbar / store icon. */
export default function BrandMark({
  size = 20,
  className,
  ...rest
}: {
  size?: number;
  className?: string;
} & ImgHTMLAttributes<HTMLImageElement>) {
  const asset = size <= 20 ? 32 : size <= 40 ? 48 : 128;
  return (
    <img
      src={iconUrl(asset)}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn('shrink-0 rounded-full shadow-[var(--glow-accent)]', className)}
      {...rest}
    />
  );
}
