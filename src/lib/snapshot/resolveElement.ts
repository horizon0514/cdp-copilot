import type { CdpConnection } from '../cdp';
import { getBoxInPage, rectCenter, ElementNotVisibleError } from '../cdp';
import { resolveUid } from './uidMap';

export interface ResolvedElement {
  backendNodeId: number;
  center: { x: number; y: number };
  box: { x: number; y: number; width: number; height: number };
}

export { ElementNotVisibleError };

/** Resolves a uid to a live node and its page-viewport box/center. */
export async function resolveElement(
  cdp: CdpConnection,
  tabId: number,
  uid: string,
): Promise<ResolvedElement> {
  const backendNodeId = resolveUid(tabId, uid);
  try {
    const box = await getBoxInPage(cdp, backendNodeId, `uid=${uid}`);
    return { backendNodeId, box, center: rectCenter(box) };
  } catch (err) {
    if (err instanceof ElementNotVisibleError) {
      throw new ElementNotVisibleError(`uid=${uid}`);
    }
    throw err;
  }
}
