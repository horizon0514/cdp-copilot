import { useEffect, useSyncExternalStore } from 'react';
import { activateLedger, getActiveLedger, subscribeLedger } from '../../lib/ledger/activeLedger';
import type { TaskLedger } from '../../lib/ledger/types';

/**
 * The ledger of the thread on screen, kept live: tool calls mutate the active
 * ledger module state mid-turn and notify subscribers, so the panel updates
 * while the agent works.
 */
export function useLedger(threadId: string): TaskLedger | null {
  useEffect(() => {
    if (threadId) void activateLedger(threadId);
  }, [threadId]);

  return useSyncExternalStore(subscribeLedger, getActiveLedger);
}
