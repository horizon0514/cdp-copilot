import type { ModelMessage } from 'ai';
import type { DisplayMessage } from '../../sidepanel/state/types';
import { redactImages } from '../images/toolImages';

const STORAGE_KEY = 'cdp-copilot:threads';
export const MAX_THREADS = 20;

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
  if (!first) return 'New chat';
  const t = first.text.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

/** Drop base64 payloads so chrome.storage.local stays under quota. */
export function sanitizeThreadForStorage(
  messages: DisplayMessage[],
  modelMessages: ModelMessage[],
): Pick<StoredThread, 'messages' | 'modelMessages'> {
  return {
    messages: messages.map((m) => ({
      ...m,
      toolCalls: m.toolCalls.map((tc) => ({
        ...tc,
        result: tc.result !== undefined ? redactImages(tc.result) : undefined,
      })),
    })),
    modelMessages,
  };
}

export function makeEmptyThread(): StoredThread {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    modelMessages: [],
  };
}

export async function loadThreadStore(): Promise<ThreadStoreSnapshot> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY] as ThreadStoreSnapshot | undefined;
  if (!raw || !Array.isArray(raw.threads)) {
    return { threads: [], activeThreadId: null };
  }
  return {
    threads: raw.threads,
    activeThreadId: raw.activeThreadId ?? raw.threads[0]?.id ?? null,
  };
}

export async function saveThreadStore(snapshot: ThreadStoreSnapshot): Promise<void> {
  // Keep newest MAX_THREADS.
  const threads = [...snapshot.threads]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS);
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      threads,
      activeThreadId: snapshot.activeThreadId,
    } satisfies ThreadStoreSnapshot,
  });
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
