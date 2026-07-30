import { DebuggerSession } from '../debugger-bridge/DebuggerSession';
import { beginSnapshot } from './uidMap';
import { AXNode, formatSnapshot } from './formatSnapshot';

export interface SnapshotResult {
  snapshotId: string;
  tabId: number;
  text: string;
  uidCount: number;
  truncated: boolean;
  chars: number;
}

interface GetFullAXTreeResult {
  nodes: AXNode[];
}

export async function takeSnapshot(session: DebuggerSession): Promise<SnapshotResult> {
  const tabId = session.getTabId();

  await session.send('DOM.enable');
  await session.send('Accessibility.enable');
  const { nodes } = await session.send<GetFullAXTreeResult>('Accessibility.getFullAXTree');

  const { snapshotId, register } = beginSnapshot(tabId);
  const { text, uidCount, truncated, chars } = formatSnapshot(nodes, register);

  return { snapshotId, tabId, text, uidCount, truncated, chars };
}
