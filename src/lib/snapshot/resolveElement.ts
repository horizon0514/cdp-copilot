import { DebuggerSession } from '../debugger-bridge/DebuggerSession';
import { resolveUid } from './uidMap';

interface BoxModelResult {
  model: {
    content: [number, number, number, number, number, number, number, number];
  };
}

export interface ResolvedElement {
  backendNodeId: number;
  center: { x: number; y: number };
}

export class ElementNotVisibleError extends Error {
  constructor(uid: string) {
    super(`Element [uid=${uid}] has no box model (not visible / zero size / detached). Try take_snapshot again.`);
    this.name = 'ElementNotVisibleError';
  }
}

/** Resolves a uid to a live node and its clickable center point, scrolling it
 * into view first. Fails fast (rather than falling back to a raw JS .click())
 * so the model can decide to re-snapshot or scroll. */
export async function resolveElement(session: DebuggerSession, uid: string): Promise<ResolvedElement> {
  const backendNodeId = resolveUid(session.getTabId(), uid);

  await session.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });

  let box: BoxModelResult;
  try {
    box = await session.send<BoxModelResult>('DOM.getBoxModel', { backendNodeId });
  } catch {
    throw new ElementNotVisibleError(uid);
  }

  const [x1, y1, , , x3, y3] = box.model.content;
  const center = { x: (x1 + x3) / 2, y: (y1 + y3) / 2 };

  return { backendNodeId, center };
}
