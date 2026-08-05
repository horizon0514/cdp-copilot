import { cdpSend, type CdpConnection } from './connection';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export class ElementNotVisibleError extends Error {
  constructor(detail = 'element') {
    super(
      `Element (${detail}) has no box model (not visible / zero size / detached). ` +
        'Try take_snapshot again.',
    );
    this.name = 'ElementNotVisibleError';
  }
}

/**
 * Page-viewport box for a node, walking up same-origin iframes.
 * DOM.getBoxModel alone is frame-local; Input and screenshots need root coords.
 *
 * Cross-origin iframes cannot be walked (and are usually invisible to a
 * tab-level debugger attach) — those throw ElementNotVisibleError.
 */
const PAGE_BOX_FN = `function () {
  const rect = this.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }
  let x = rect.left;
  let y = rect.top;
  let win = this.ownerDocument && this.ownerDocument.defaultView;
  while (win) {
    let frame;
    try {
      frame = win.frameElement;
    } catch (err) {
      return null;
    }
    if (!frame) break;
    const frameRect = frame.getBoundingClientRect();
    x += frameRect.left;
    y += frameRect.top;
    try {
      const style = win.parent.getComputedStyle(frame);
      x += parseFloat(style.borderLeftWidth) || 0;
      y += parseFloat(style.borderTopWidth) || 0;
    } catch (err) {
      /* ignore */
    }
    win = win.parent;
  }
  return { x: x, y: y, width: rect.width, height: rect.height };
}`;

export async function getBoxInPage(
  cdp: CdpConnection,
  backendNodeId: number,
  detail = String(backendNodeId),
): Promise<Rect> {
  await cdpSend(cdp, 'DOM.scrollIntoViewIfNeeded', { backendNodeId });

  const { object } = await cdpSend(cdp, 'DOM.resolveNode', { backendNodeId });
  if (!object?.objectId) throw new ElementNotVisibleError(detail);

  try {
    const { result, exceptionDetails } = await cdpSend(cdp, 'Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration: PAGE_BOX_FN,
      returnByValue: true,
    });
    if (exceptionDetails) {
      throw new ElementNotVisibleError(detail);
    }
    const box = result?.value as Rect | null;
    if (!box || (box.width === 0 && box.height === 0)) {
      throw new ElementNotVisibleError(detail);
    }
    return box;
  } finally {
    await cdpSend(cdp, 'Runtime.releaseObject', { objectId: object.objectId }).catch(() => {
      /* object may already be gone */
    });
  }
}

export function rectCenter(box: Rect): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
