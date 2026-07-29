import { registerNavigationHook } from '../debugger-bridge/navigationInvalidation';

interface SnapshotState {
  snapshotId: string;
  uidToBackendNodeId: Map<string, number>;
}

const stateByTab = new Map<number, SnapshotState>();

registerNavigationHook((tabId) => stateByTab.delete(tabId));

/** Starts a fresh uid namespace for a tab; the previous map is discarded so
 * uids are only ever valid until the next take_snapshot call. */
export function beginSnapshot(tabId: number): { snapshotId: string; register: (backendNodeId: number) => string } {
  const snapshotId = crypto.randomUUID();
  const uidToBackendNodeId = new Map<string, number>();
  let counter = 0;
  stateByTab.set(tabId, { snapshotId, uidToBackendNodeId });

  return {
    snapshotId,
    register(backendNodeId: number): string {
      counter += 1;
      const uid = String(counter);
      uidToBackendNodeId.set(uid, backendNodeId);
      return uid;
    },
  };
}

export class UnknownUidError extends Error {
  constructor(uid: string) {
    super(`uid "${uid}" is not from the latest snapshot. Call take_snapshot again and use a fresh uid.`);
    this.name = 'UnknownUidError';
  }
}

export function resolveUid(tabId: number, uid: string): number {
  const backendNodeId = stateByTab.get(tabId)?.uidToBackendNodeId.get(uid);
  if (backendNodeId === undefined) throw new UnknownUidError(uid);
  return backendNodeId;
}
