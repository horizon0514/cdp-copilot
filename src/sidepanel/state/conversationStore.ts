import { create } from 'zustand';
import type { ModelMessage } from 'ai';
import type { StopInfo, TurnResponseMessage } from '../../lib/llm/agentLoop';
import {
  loadThreadStore,
  makeEmptyThread,
  saveThreadStore,
  upsertActiveThread,
  type StoredThread,
} from '../../lib/storage/chatThreads';
import type { DisplayMessage, DisplayToolCall } from './types';

export type { DisplayMessage, DisplayToolCall } from './types';

export interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: number;
}

interface ConversationState {
  hydrated: boolean;
  threadId: string;
  threadCreatedAt: number;
  messages: DisplayMessage[];
  modelMessages: ModelMessage[];
  threadList: ThreadSummary[];
  isStreaming: boolean;

  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  newChat: () => Promise<void>;
  switchThread: (id: string) => Promise<void>;

  addUserMessage: (text: string) => void;
  startAssistantMessage: () => string;
  appendAssistantText: (id: string, delta: string) => void;
  addToolCall: (id: string, call: Omit<DisplayToolCall, 'status'>) => void;
  updateToolResult: (id: string, toolCallId: string, result: unknown) => void;
  updateToolError: (id: string, toolCallId: string, error: string) => void;
  setMessageError: (id: string, error: string) => void;
  setMessageStop: (id: string, stop: StopInfo) => void;
  commitTurn: (userText: string, responseMessages: TurnResponseMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  reset: () => void;
}

function updateMessage(
  messages: DisplayMessage[],
  id: string,
  update: (m: DisplayMessage) => DisplayMessage,
): DisplayMessage[] {
  return messages.map((m) => (m.id === id ? update(m) : m));
}

function summaries(threads: StoredThread[]): ThreadSummary[] {
  return [...threads]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt }));
}

function fromStored(thread: StoredThread) {
  return {
    threadId: thread.id,
    threadCreatedAt: thread.createdAt,
    messages: thread.messages,
    modelMessages: thread.modelMessages,
  };
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  hydrated: false,
  threadId: '',
  threadCreatedAt: Date.now(),
  messages: [],
  modelMessages: [],
  threadList: [],
  isStreaming: false,

  hydrate: async () => {
    const snapshot = await loadThreadStore();
    const active =
      snapshot.threads.find((t) => t.id === snapshot.activeThreadId) ??
      snapshot.threads[0] ??
      makeEmptyThread();

    const threads = snapshot.threads.some((t) => t.id === active.id)
      ? snapshot.threads
      : [active, ...snapshot.threads];

    set({
      hydrated: true,
      ...fromStored(active),
      threadList: summaries(threads),
      isStreaming: false,
    });

    if (snapshot.threads.length === 0) {
      await saveThreadStore({ threads: [active], activeThreadId: active.id });
    }
  },

  persist: async () => {
    const state = get();
    if (!state.hydrated || !state.threadId) return;
    const snapshot = await loadThreadStore();
    const next = upsertActiveThread(snapshot, {
      id: state.threadId,
      messages: state.messages,
      modelMessages: state.modelMessages,
      createdAt: state.threadCreatedAt,
    });
    await saveThreadStore(next);
    set({ threadList: summaries(next.threads) });
  },

  newChat: async () => {
    const state = get();
    if (state.isStreaming) return;

    if (state.hydrated && state.threadId) {
      await get().persist();
    }

    const fresh = makeEmptyThread();
    const snapshot = await loadThreadStore();
    const next = {
      threads: [fresh, ...snapshot.threads.filter((t) => t.id !== fresh.id)],
      activeThreadId: fresh.id,
    };
    await saveThreadStore(next);
    set({
      ...fromStored(fresh),
      threadList: summaries(next.threads),
      isStreaming: false,
    });
  },

  switchThread: async (id) => {
    const state = get();
    if (state.isStreaming || id === state.threadId) return;

    await get().persist();
    const snapshot = await loadThreadStore();
    const thread = snapshot.threads.find((t) => t.id === id);
    if (!thread) return;

    await saveThreadStore({ ...snapshot, activeThreadId: id });
    set({
      ...fromStored(thread),
      threadList: summaries(snapshot.threads),
      isStreaming: false,
    });
  },

  addUserMessage: (text) =>
    set((state) => ({
      messages: [...state.messages, { id: crypto.randomUUID(), role: 'user', text, toolCalls: [] }],
    })),

  startAssistantMessage: () => {
    const id = crypto.randomUUID();
    set((state) => ({
      messages: [...state.messages, { id, role: 'assistant', text: '', toolCalls: [] }],
    }));
    return id;
  },

  appendAssistantText: (id, delta) =>
    set((state) => ({
      messages: updateMessage(state.messages, id, (m) => ({ ...m, text: m.text + delta })),
    })),

  addToolCall: (id, call) =>
    set((state) => ({
      messages: updateMessage(state.messages, id, (m) => ({
        ...m,
        toolCalls: [...m.toolCalls, { ...call, status: 'running' }],
      })),
    })),

  updateToolResult: (id, toolCallId, result) =>
    set((state) => ({
      messages: updateMessage(state.messages, id, (m) => ({
        ...m,
        toolCalls: m.toolCalls.map((tc) => (tc.id === toolCallId ? { ...tc, status: 'done', result } : tc)),
      })),
    })),

  updateToolError: (id, toolCallId, error) =>
    set((state) => ({
      messages: updateMessage(state.messages, id, (m) => ({
        ...m,
        toolCalls: m.toolCalls.map((tc) => (tc.id === toolCallId ? { ...tc, status: 'error', error } : tc)),
      })),
    })),

  setMessageError: (id, error) =>
    set((state) => ({
      messages: updateMessage(state.messages, id, (m) => ({ ...m, error })),
    })),

  setMessageStop: (id, stop) =>
    set((state) => ({
      messages: updateMessage(state.messages, id, (m) => ({ ...m, stop })),
    })),

  commitTurn: (userText, responseMessages) =>
    set((state) => ({
      modelMessages: [
        ...state.modelMessages,
        { role: 'user', content: userText },
        ...responseMessages,
      ],
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  reset: () => {
    const fresh = makeEmptyThread();
    set({
      ...fromStored(fresh),
      threadList: [],
      isStreaming: false,
      hydrated: false,
    });
  },
}));
