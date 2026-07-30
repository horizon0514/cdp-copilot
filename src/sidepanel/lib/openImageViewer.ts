import { showPageImageOverlay } from '../../lib/overlay/pageImageOverlay';

/**
 * Prefer a full-page overlay on the active/attached tab. Falls back to the
 * in-sidepanel lightbox when the page can't be scripted (chrome://, denied, etc.).
 */
export async function openImageViewer(
  src: string,
  alt: string,
  fallback: () => void,
): Promise<void> {
  const ok = await showPageImageOverlay(src, alt);
  if (!ok) fallback();
}
