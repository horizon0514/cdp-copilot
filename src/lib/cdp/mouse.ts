import { cdpSend, type CdpConnection } from './connection';
import type { Point } from './geometry';

export interface ClickOptions {
  /** Number of clicks. 2 emits a real dblclick sequence (Puppeteer-style). */
  count?: number;
  button?: 'left' | 'right' | 'middle';
}

async function mouseMoved(cdp: CdpConnection, point: Point): Promise<void> {
  await cdpSend(cdp, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: point.x,
    y: point.y,
  });
}

async function mouseClickCycle(
  cdp: CdpConnection,
  point: Point,
  clickCount: number,
  button: 'left' | 'right' | 'middle',
): Promise<void> {
  await cdpSend(cdp, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button,
    clickCount,
  });
  await cdpSend(cdp, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button,
    clickCount,
  });
}

/**
 * Click at page-viewport coordinates.
 * Double-click is two press/release cycles with clickCount 1 then 2 — a single
 * cycle with clickCount: 2 does not reliably fire dblclick handlers.
 */
export async function clickAt(
  cdp: CdpConnection,
  point: Point,
  options: ClickOptions = {},
): Promise<void> {
  const count = options.count ?? 1;
  const button = options.button ?? 'left';
  if (count < 1) throw new Error('Click count must be >= 1');

  await mouseMoved(cdp, point);
  for (let i = 1; i <= count; i++) {
    await mouseClickCycle(cdp, point, i, button);
  }
}

export async function hoverAt(cdp: CdpConnection, point: Point): Promise<void> {
  await mouseMoved(cdp, point);
}
