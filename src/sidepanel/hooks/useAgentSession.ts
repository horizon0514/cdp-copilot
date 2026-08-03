import { useCallback, useEffect, useRef } from 'react';
import { useConversationStore } from '../state/conversationStore';
import { runAgentTurn } from '../../lib/llm/agentLoop';
import { Settings } from '../../lib/storage/schema';
import { agentTabTracker } from '../../lib/pages/agentTabTracker';
import { getBoundTabId, ensureSession, releaseStaleBinding } from '../../lib/tools/context';
import { createTurnSequencer, type TurnSequencer } from '../lib/turnSequencer';

export function useAgentSession(settings: Settings | null) {
  const messages = useConversationStore((s) => s.messages);
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

  const sequencerRef = useRef<TurnSequencer | null>(null);
  sequencerRef.current ??= createTurnSequencer();

  // The side panel closes mid-turn often enough that leaving the run detached
  // would keep driving the page with nothing rendering it.
  useEffect(() => {
    const sequencer = sequencerRef.current;
    return () => sequencer?.abort();
  }, []);

  const runTurn = useCallback(
    async (text: string, signal: AbortSignal) => {
      if (!settings) return;

      // Read history from the store rather than a subscribed value: a turn that
      // takes over from another starts before React has re-rendered with the
      // previous turn's committed messages.
      const history = useConversationStore.getState().modelMessages;
      addUserMessage(text);
      const assistantId = startAssistantMessage();
      setStreaming(true);

      // Bind the turn to the current session tab (or active tab on first use)
      // and track any tabs new_page opens for cleanup when the turn ends.
      try {
        const session = await ensureSession();
        agentTabTracker.beginTurn(session.getTabId());
      } catch {
        agentTabTracker.beginTurn(getBoundTabId());
      }

      try {
        for await (const event of runAgentTurn(settings, history, text, signal)) {
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
        setStreaming(false);
        await agentTabTracker.cleanup();
        await persist();
      }
    },
    [
      settings,
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
    sequencerRef.current?.abort();
  }, []);

  /**
   * Sending while the agent runs takes the turn over: stop it, let it commit
   * what it got done, then start fresh with that in history. Queueing behind the
   * running turn was the other option, but the whole point of typing mid-run is
   * that the agent is going the wrong way — watching it finish first is the
   * thing being complained about.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      await sequencerRef.current?.takeOver((signal) => runTurn(text, signal));
    },
    [runTurn],
  );

  // Leaving a conversation drops a stale tab binding with it — see
  // releaseStaleBinding. Both stores refuse to switch mid-turn anyway; the
  // guard here keeps the binding from being released without that happening.
  const startNewChat = useCallback(async () => {
    if (isStreaming) return;
    await releaseStaleBinding();
    await newChat();
  }, [isStreaming, newChat]);

  const openThread = useCallback(
    async (id: string) => {
      if (isStreaming || id === threadId) return;
      await releaseStaleBinding();
      await switchThread(id);
    },
    [isStreaming, threadId, switchThread],
  );

  return {
    messages,
    isStreaming,
    sendMessage,
    stopAgent,
    threadId,
    threadList,
    hydrated,
    hydrate,
    newChat: startNewChat,
    switchThread: openThread,
  };
}
