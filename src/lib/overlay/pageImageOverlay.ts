import { sessionRegistry } from '../debugger-bridge/sessionRegistry';

/**
 * Injected into the page tab. Must be self-contained (no closed-over imports) —
 * chrome.scripting serializes this function by toString().
 */
export function installPageImageLightbox(src: string, alt: string): void {
  const ROOT_ID = 'cdp-copilot-image-lightbox';
  document.getElementById(ROOT_ID)?.remove();

  const MIN = 0.25;
  const MAX = 5;
  const STEP = 0.25;
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let drag: { x: number; y: number; ox: number; oy: number } | null = null;
  let dragMoved = false;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Image preview');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0,0,0,0.82)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: 'rgba(255,255,255,0.85)',
  });

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    height: '40px',
    padding: '0 8px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexShrink: '0',
  });

  const title = document.createElement('span');
  title.textContent = alt;
  Object.assign(title.style, {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    opacity: '0.75',
    padding: '0 4px',
  });

  const controls = document.createElement('div');
  Object.assign(controls.style, { display: 'flex', alignItems: 'center', gap: '2px' });

  const zoomLabel = document.createElement('span');
  Object.assign(zoomLabel.style, {
    minWidth: '48px',
    textAlign: 'center',
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
    opacity: '0.7',
  });

  const mkBtn = (label: string, aria: string, onClick: () => void, svg?: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    if (svg) {
      b.innerHTML = svg;
      const el = b.firstElementChild as HTMLElement | null;
      if (el) Object.assign(el.style, { display: 'block', margin: '0 auto' });
    } else {
      b.textContent = label;
    }
    Object.assign(b.style, {
      width: '28px',
      height: '28px',
      border: 'none',
      borderRadius: '6px',
      background: 'transparent',
      color: 'rgba(255,255,255,0.85)',
      cursor: 'pointer',
      fontSize: '16px',
      lineHeight: '1',
      display: 'grid',
      placeItems: 'center',
      padding: '0',
    });
    b.addEventListener('mouseenter', () => {
      b.style.background = 'rgba(255,255,255,0.1)';
    });
    b.addEventListener('mouseleave', () => {
      b.style.background = 'transparent';
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  // Arrow-down-to-line (matches sidepanel lucide icon).
  const downloadSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>';

  const stage = document.createElement('div');
  Object.assign(stage.style, {
    position: 'relative',
    flex: '1',
    minHeight: '0',
    overflow: 'hidden',
    cursor: 'default',
  });

  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '12px',
    boxSizing: 'border-box',
  });

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.draggable = false;
  Object.assign(img.style, {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    userSelect: 'none',
    transformOrigin: 'center center',
    transition: 'transform 75ms linear',
  });

  const hint = document.createElement('div');
  hint.textContent = 'Scroll to zoom · drag to pan · Esc to close';
  Object.assign(hint.style, {
    flexShrink: '0',
    padding: '6px 12px',
    textAlign: 'center',
    fontSize: '10px',
    opacity: '0.45',
  });

  const applyTransform = () => {
    img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    stage.style.cursor = zoom > 1 ? 'grab' : 'default';
  };

  const bump = (delta: number) => {
    zoom = Math.min(MAX, Math.max(MIN, +(zoom + delta).toFixed(2)));
    applyTransform();
  };

  const reset = () => {
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    applyTransform();
  };

  const download = () => {
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
  };

  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    root.remove();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === '+' || e.key === '=') {
      bump(STEP);
    } else if (e.key === '-' || e.key === '_') {
      bump(-STEP);
    } else if (e.key === '0') {
      reset();
    }
  };

  controls.append(
    mkBtn('−', 'Zoom out', () => bump(-STEP)),
    zoomLabel,
    mkBtn('+', 'Zoom in', () => bump(STEP)),
    mkBtn('↺', 'Reset zoom', reset),
    mkBtn('', 'Download', download, downloadSvg),
    mkBtn('✕', 'Close', close),
  );
  bar.append(title, controls);
  wrap.append(img);
  stage.append(wrap);
  root.append(bar, stage, hint);
  document.documentElement.append(root);
  applyTransform();

  // Click the dimmed backdrop to close; clicking the image itself does not.
  root.addEventListener('click', close);
  bar.addEventListener('click', (e) => e.stopPropagation());
  hint.addEventListener('click', (e) => e.stopPropagation());
  img.addEventListener('click', (e) => e.stopPropagation());
  stage.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    // Only the empty stage/wrap (not the <img>) dismisses.
    if (e.target === img) return;
    close();
  });

  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      bump(e.deltaY < 0 ? STEP : -STEP);
    },
    { passive: false },
  );

  stage.addEventListener('pointerdown', (e) => {
    if (zoom <= 1) return;
    stage.setPointerCapture(e.pointerId);
    dragMoved = false;
    drag = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
    stage.style.cursor = 'grabbing';
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) > 3 || Math.abs(e.clientY - drag.y) > 3) {
      dragMoved = true;
    }
    offsetX = drag.ox + (e.clientX - drag.x);
    offsetY = drag.oy + (e.clientY - drag.y);
    applyTransform();
  });
  stage.addEventListener('pointerup', () => {
    drag = null;
    stage.style.cursor = zoom > 1 ? 'grab' : 'default';
  });

  window.addEventListener('keydown', onKey, true);
}

async function resolveTargetTabId(): Promise<number | undefined> {
  const attached = sessionRegistry.getAttached()?.getTabId();
  if (attached != null) return attached;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/** Ensure we can inject into the tab's origin (optional host permission). */
async function ensureHostAccess(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return false;
    }
    const origin = new URL(tab.url).origin;
    if (origin === 'null') return false;
    const already = await chrome.permissions.contains({ origins: [`${origin}/*`] });
    if (already) return true;
    return chrome.permissions.request({ origins: [`${origin}/*`] });
  } catch {
    return false;
  }
}

/**
 * Show the image lightbox on the page tab (full browser viewport), not the
 * side panel. Returns false if injection isn't possible — caller should fall back.
 */
export async function showPageImageOverlay(src: string, alt: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) return false;

  const tabId = await resolveTargetTabId();
  if (tabId == null) return false;
  if (!(await ensureHostAccess(tabId))) return false;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: installPageImageLightbox,
      args: [src, alt],
    });
    return true;
  } catch {
    return false;
  }
}
