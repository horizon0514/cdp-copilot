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
 * Sum same-origin iframe offsets so a frame-local box can be placed in the
 * root viewport. Cross-origin frames cannot be walked and contribute 0 — those
 * nodes are usually invisible to a tab-level debugger attach anyway.
 */
const FRAME_OFFSET_FN = `function () {
  let x = 0;
  let y = 0;
  let win = this.ownerDocument && this.ownerDocument.defaultView;
  while (win) {
    var frame;
    try {
      frame = win.frameElement;
    } catch (err) {
      break;
    }
    if (!frame) break;
    var frameRect = frame.getBoundingClientRect();
    x += frameRect.left;
    y += frameRect.top;
    try {
      var style = win.parent.getComputedStyle(frame);
      x += parseFloat(style.borderLeftWidth) || 0;
      y += parseFloat(style.borderTopWidth) || 0;
    } catch (err) {
      /* ignore */
    }
    win = win.parent;
  }
  return { x: x, y: y };
}`;

async function frameOffset(cdp: CdpConnection, backendNodeId: number): Promise<Point> {
  try {
    const { object } = await cdpSend(cdp, 'DOM.resolveNode', { backendNodeId });
    if (!object?.objectId) return { x: 0, y: 0 };
    try {
      const { result, exceptionDetails } = await cdpSend(cdp, 'Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: FRAME_OFFSET_FN,
        returnByValue: true,
      });
      if (exceptionDetails) return { x: 0, y: 0 };
      const offset = result?.value as Point | undefined;
      return offset ?? { x: 0, y: 0 };
    } finally {
      await cdpSend(cdp, 'Runtime.releaseObject', { objectId: object.objectId }).catch(() => {
        /* object may already be gone */
      });
    }
  } catch {
    return { x: 0, y: 0 };
  }
}

/**
 * Page-viewport box for a node.
 * Uses DOM.getBoxModel for the frame-local rect (reliable with AX backendNodeIds),
 * then adds same-origin iframe offsets so Input/screenshot coords match the root.
 */
export async function getBoxInPage(
  cdp: CdpConnection,
  backendNodeId: number,
  detail = String(backendNodeId),
): Promise<Rect> {
  await cdpSend(cdp, 'DOM.scrollIntoViewIfNeeded', { backendNodeId });

  let model: { content: number[] };
  try {
    ({ model } = await cdpSend(cdp, 'DOM.getBoxModel', { backendNodeId }));
  } catch {
    throw new ElementNotVisibleError(detail);
  }

  const [x1, y1, , , x3, y3] = model.content;
  const width = x3 - x1;
  const height = y3 - y1;
  if (width === 0 && height === 0) throw new ElementNotVisibleError(detail);

  const offset = await frameOffset(cdp, backendNodeId);
  return {
    x: x1 + offset.x,
    y: y1 + offset.y,
    width,
    height,
  };
}

export function rectCenter(box: Rect): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
