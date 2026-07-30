import { create } from 'zustand';
import type { ModelMessage } from 'ai';
import type { StopInfo, TurnResponseMessage } from '../../lib/llm/agentLoop';

export interface DisplayToolCall {
  id: string;
  name: string;
  args: unknown;
  status: 'running' | 'done' | 'error';
  result?: unknown;
  error?: string;
}

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls: DisplayToolCall[];
  error?: string;
  stop?: StopInfo;
}

interface ConversationState {
  /** Display transcript for the UI. */
  messages: DisplayMessage[];
  /**
   * Exact ModelMessages for the next LLM turn — includes tool-call / tool-result
   * parts. Kept separately so the UI can stay lossy/pretty while the model gets
   * a faithful history.
   */
  modelMessages: ModelMessage[];
  isStreaming: boolean;
  addUserMessage: (text: string) => void;
  startAssistantMessage: () => string;
  appendAssistantText: (id: string, delta: string) => void;
  addToolCall: (id: string, call: Omit<DisplayToolCall, 'status'>) => void;
  updateToolResult: (id: string, toolCallId: string, result: unknown) => void;
  updateToolError: (id: string, toolCallId: string, error: string) => void;
  setMessageError: (id: string, error: string) => void;
  setMessageStop: (id: string, stop: StopInfo) => void;
  /** Append the user turn + SDK responseMessages to the model history. */
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

export const useConversationStore = create<ConversationState>((set) => ({
  messages: [],
  modelMessages: [],
  isStreaming: false,

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

  reset: () => set({ messages: [], modelMessages: [], isStreaming: false }),
}));
