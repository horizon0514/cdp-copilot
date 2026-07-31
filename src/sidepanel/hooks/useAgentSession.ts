import { useCallback, useEffect, useRef } from 'react';
import { useConversationStore } from '../state/conversationStore';
import { runAgentTurn } from '../../lib/llm/agentLoop';
import { Settings } from '../../lib/storage/schema';
import { agentTabTracker } from '../../lib/pages/agentTabTracker';
import { getBoundTabId, ensureSession } from '../../lib/tools/context';

export function useAgentSession(settings: Settings | null) {
  const messages = useConversationStore((s) => s.messages);
  const modelMessages = useConversationStore((s) => s.modelMessages);
  const isStreaming = useConversationStore((s) => s.isStreaming);
  const threadId = useConversationStore((s) => s.threadId);
  const threadList = useConversationStore((s) => s.threadList);
  const hydrated = useConversationStore((s) => s.hydrated);
  const hydrate = useConversationStore((s) => s.hydrate);
  const persist = useConversationStore((s) => s.persist);
  const newChat = useConversationStore((s) => s.newChat);
  const switchThread = useConversationStore((s) => s.switchThread);
  const addUserMessage = useConversationStore((s) => s.addUserMessage);
  const startAssistantMessage = useConversationStore((s) => s.startAssistantMessage);
  const appendAssistantText = useConversationStore((s) => s.appendAssistantText);
  const addToolCall = useConversationStore((s) => s.addToolCall);
  const updateToolResult = useConversationStore((s) => s.updateToolResult);
  const updateToolError = useConversationStore((s) => s.updateToolError);
  const abandonRunningToolCalls = useConversationStore((s) => s.abandonRunningToolCalls);
  const setMessageError = useConversationStore((s) => s.setMessageError);
  const setMessageStop = useConversationStore((s) => s.setMessageStop);
  const commitTurn = useConversationStore((s) => s.commitTurn);
  const setStreaming = useConversationStore((s) => s.setStreaming);

  /** Live turn's controller — `stop()` is the only way out of a long agent run. */
  const abortRef = useRef<AbortController | null>(null);

  // The side panel closes mid-turn often enough that leaving the run detached
  // would keep driving the page with nothing rendering it.
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!settings || !text.trim()) return;

      // Snapshot history before mutating display state — this is the faithful
      // ModelMessage trail (tool calls/results included), not the UI text.
      const history = modelMessages;
      addUserMessage(text);
      const assistantId = startAssistantMessage();
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Bind the turn to the current session tab (or active tab on first use)
      // and track any tabs new_page opens for cleanup when the turn ends.
      try {
        const session = await ensureSession();
        agentTabTracker.beginTurn(session.getTabId());
      } catch {
        agentTabTracker.beginTurn(getBoundTabId());
      }

      try {
        for await (const event of runAgentTurn(settings, history, text, controller.signal)) {
          switch (event.type) {
            case 'text-delta':
              appendAssistantText(assistantId, event.text);
              break;
            case 'tool-call':
              addToolCall(assistantId, { id: event.toolCallId, name: event.name, args: event.args });
              break;
            case 'tool-result':
              updateToolResult(assistantId, event.toolCallId, event.result);
              break;
            case 'tool-error':
              updateToolError(assistantId, event.toolCallId, event.error);
              break;
            case 'error':
              setMessageError(assistantId, event.message);
              break;
            case 'done':
              setMessageStop(assistantId, event.stop);
              commitTurn(text, event.responseMessages);
              console.debug('[cdp-copilot] turn ended', event.stop);
              break;
          }
        }
      } finally {
        abandonRunningToolCalls(assistantId);
        abortRef.current = null;
        setStreaming(false);
        await agentTabTracker.cleanup();
        await persist();
      }
    },
    [
      settings,
      modelMessages,
      addUserMessage,
      startAssistantMessage,
      appendAssistantText,
      addToolCall,
      updateToolResult,
      updateToolError,
      abandonRunningToolCalls,
      setMessageError,
      setMessageStop,
      commitTurn,
      setStreaming,
      persist,
    ],
  );

  const stopAgent = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopAgent,
    threadId,
    threadList,
    hydrated,
    hydrate,
    newChat,
    switchThread,
  };
}
