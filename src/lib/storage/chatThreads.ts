import type { ModelMessage } from 'ai';
import type { DisplayMessage } from '../../sidepanel/state/types';
import { idbGet, idbSet } from './idb';

const IDB_KEY = 'threads';
/** Previous backend — migrated once into IndexedDB then removed. */
const LEGACY_CHROME_KEY = 'cdp-copilot:threads';
export const MAX_THREADS = 20;

/** Persisted marker for a thread that has no user message yet. */
export const UNTITLED_THREAD_TITLE = '';

/** Legacy / locale-frozen placeholders that should render via i18n. */
const UNTITLED_TITLE_ALIASES = new Set(['', 'New chat', '新对话']);

export function isUntitledThreadTitle(title: string | null | undefined): boolean {
  return title == null || UNTITLED_TITLE_ALIASES.has(title);
}

export interface StoredThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: DisplayMessage[];
  modelMessages: ModelMessage[];
}

export interface ThreadStoreSnapshot {
  threads: StoredThread[];
  activeThreadId: string | null;
}

function titleFromMessages(messages: DisplayMessage[]): string {
  const first = messages.find((m) => m.role === 'user' && m.text.trim());
  if (!first) return UNTITLED_THREAD_TITLE;
  const t = first.text.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

/**
 * Prepare a thread for persistence. IndexedDB has ample quota, so screenshot
 * data-URLs in display messages are kept (unlike the old chrome.storage path).
 */
export function sanitizeThreadForStorage(
  messages: DisplayMessage[],
  modelMessages: ModelMessage[],
): Pick<StoredThread, 'messages' | 'modelMessages'> {
  return { messages, modelMessages };
}

export function makeEmptyThread(): StoredThread {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: UNTITLED_THREAD_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
    modelMessages: [],
  };
}

function normalizeSnapshot(raw: ThreadStoreSnapshot | undefined): ThreadStoreSnapshot {
  if (!raw || !Array.isArray(raw.threads)) {
    return { threads: [], activeThreadId: null };
  }
  return {
    threads: raw.threads,
    activeThreadId: raw.activeThreadId ?? raw.threads[0]?.id ?? null,
  };
}

async function migrateFromChromeStorage(): Promise<ThreadStoreSnapshot | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
  try {
    const result = await chrome.storage.local.get(LEGACY_CHROME_KEY);
    const raw = result[LEGACY_CHROME_KEY] as ThreadStoreSnapshot | undefined;
    if (!raw || !Array.isArray(raw.threads)) return null;
    await chrome.storage.local.remove(LEGACY_CHROME_KEY);
    return normalizeSnapshot(raw);
  } catch {
    return null;
  }
}

export async function loadThreadStore(): Promise<ThreadStoreSnapshot> {
  const existing = await idbGet<ThreadStoreSnapshot>(IDB_KEY);
  if (existing && Array.isArray(existing.threads)) {
    return normalizeSnapshot(existing);
  }

  const migrated = await migrateFromChromeStorage();
  if (migrated && migrated.threads.length > 0) {
    await idbSet(IDB_KEY, migrated);
    return migrated;
  }

  return { threads: [], activeThreadId: null };
}

export async function saveThreadStore(snapshot: ThreadStoreSnapshot): Promise<void> {
  const threads = [...snapshot.threads]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS);
  await idbSet(IDB_KEY, {
    threads,
    activeThreadId: snapshot.activeThreadId,
  } satisfies ThreadStoreSnapshot);
}

export function upsertActiveThread(
  snapshot: ThreadStoreSnapshot,
  active: {
    id: string;
    messages: DisplayMessage[];
    modelMessages: ModelMessage[];
    createdAt: number;
  },
): ThreadStoreSnapshot {
  const sanitized = sanitizeThreadForStorage(active.messages, active.modelMessages);
  const title = titleFromMessages(active.messages);
  const updatedAt = Date.now();
  const next: StoredThread = {
    id: active.id,
    title,
    createdAt: active.createdAt,
    updatedAt,
    ...sanitized,
  };
  const others = snapshot.threads.filter((t) => t.id !== active.id);
  return {
    threads: [next, ...others],
    activeThreadId: active.id,
  };
}
