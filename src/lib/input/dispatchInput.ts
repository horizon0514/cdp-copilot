import type { CdpConnection } from '../cdp';
import {
  clickAt,
  hoverAt,
  insertText,
  pressKeyCombo,
  selectAll,
  typeText as typeTextCdp,
} from '../cdp';
import { resolveElement } from '../snapshot/resolveElement';

/** Extension-facing helpers: uid → geometry → CDP input. */

export async function clickUid(
  cdp: CdpConnection,
  tabId: number,
  uid: string,
  dblClick = false,
): Promise<void> {
  const { center } = await resolveElement(cdp, tabId, uid);
  await clickAt(cdp, center, { count: dblClick ? 2 : 1 });
}

export async function hoverUid(cdp: CdpConnection, tabId: number, uid: string): Promise<void> {
  const { center } = await resolveElement(cdp, tabId, uid);
  await hoverAt(cdp, center);
}

/** "Set the value" semantics: focus, clear, insert. */
export async function fillUid(
  cdp: CdpConnection,
  tabId: number,
  uid: string,
  value: string,
): Promise<void> {
  const { center } = await resolveElement(cdp, tabId, uid);
  await clickAt(cdp, center, { count: 1 });
  await selectAll(cdp, navigator.platform.toLowerCase().includes('mac'));
  await insertText(cdp, value);
}

export async function typeText(
  cdp: CdpConnection,
  text: string,
  submitKey?: string,
): Promise<void> {
  await typeTextCdp(cdp, text, submitKey);
}

export { pressKeyCombo };
