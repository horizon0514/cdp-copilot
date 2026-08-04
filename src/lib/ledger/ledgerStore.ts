import { idbGet, idbSet } from '../storage/idb';
import { isLedgerEmpty, type TaskLedger } from './types';

const IDB_KEY = 'ledgers';
/** Mirrors MAX_THREADS in chatThreads — a ledger without its thread is dead weight. */
export const MAX_LEDGERS = 20;

interface LedgerStoreSnapshot {
  ledgers: Record<string, TaskLedger>;
}

async function loadSnapshot(): Promise<LedgerStoreSnapshot> {
  const raw = await idbGet<LedgerStoreSnapshot>(IDB_KEY);
  if (!raw || typeof raw.ledgers !== 'object' || raw.ledgers === null) {
    return { ledgers: {} };
  }
  return raw;
}

export async function loadLedger(threadId: string): Promise<TaskLedger | null> {
  const snapshot = await loadSnapshot();
  return snapshot.ledgers[threadId] ?? null;
}

export async function saveLedger(ledger: TaskLedger): Promise<void> {
  const snapshot = await loadSnapshot();
  const ledgers = { ...snapshot.ledgers };

  if (isLedgerEmpty(ledger)) {
    // Nothing worth keeping — also drops a previously stored copy the model
    // has since emptied out.
    delete ledgers[ledger.threadId];
  } else {
    ledgers[ledger.threadId] = ledger;
  }

  const kept = Object.values(ledgers)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_LEDGERS);

  await idbSet(IDB_KEY, {
    ledgers: Object.fromEntries(kept.map((l) => [l.threadId, l])),
  } satisfies LedgerStoreSnapshot);
}

export async function deleteLedger(threadId: string): Promise<void> {
  const snapshot = await loadSnapshot();
  if (!(threadId in snapshot.ledgers)) return;
  const ledgers = { ...snapshot.ledgers };
  delete ledgers[threadId];
  await idbSet(IDB_KEY, { ledgers } satisfies LedgerStoreSnapshot);
}
