/**
 * Transport-agnostic CDP automation helpers.
 *
 * Bind a {@link CdpConnection} (chrome.debugger, Puppeteer CDPSession, …)
 * and reuse click / geometry / navigate / wait without the extension layer.
 */
export type { CdpConnection } from './connection';
export { cdpSend, onceEvent } from './connection';

export { evaluateFunction, type EvaluateOptions } from './evaluate';

export {
  getBoxInPage,
  rectCenter,
  ElementNotVisibleError,
  type Rect,
  type Point,
} from './geometry';

export { clickAt, hoverAt, type ClickOptions } from './mouse';

export { pressKeyCombo, selectAll, insertText, typeText } from './keyboard';
export { parseKeyCombo, type KeyDescriptor, type ParsedKeyCombo } from './keys';

export {
  navigate,
  reload,
  waitForNextLoad,
  traverseHistory,
  type NavigateOptions,
  type WaitUntil,
} from './navigate';

export { waitForText, type WaitForTextOptions } from './wait';
