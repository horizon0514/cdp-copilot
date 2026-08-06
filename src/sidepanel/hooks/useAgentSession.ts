import { useCallback, useEffect, useRef } from 'react';
import { useConversationStore } from '../state/conversationStore';
import { runAgentTurn } from '../../lib/llm/agentLoop';
import { Settings } from '../../lib/storage/schema';
import { agentTabTracker } from '../../lib/pages/agentTabTracker';
import { listPages } from '../../lib/pages/PageManager';
import { peekMentionedTabs } from '../../lib/pages/peekMentions';
import { buildTabContext, parseTabMentions, toDisplayText } from '../../lib/pages/tabMentions';
import {
  getBoundTabId,
  ensureSession,
  bindToActiveTab,
  releaseStaleBinding,
} from '../../lib/tools/context';
import { createTurnSequencer, type TurnSequencer } from '../lib/turnSequencer';
import { activateLedger } from '../../lib/ledger/activeLedger';

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
      if (!settings) {
        // Returning quietly here reads as the extension being broken: the
        // message goes nowhere and nothing says why. Settings only auto-open
        // once, on mount, so a panel dismissed by hand leaves the user typing
        // into a void.
        addUserMessage(toDisplayText(text));
        setMessageError(startAssistantMessage(), 'Finish setup in Settings first.');
        return;
      }

      // Read history from the store rather than a subscribed value: a turn that
      // takes over from another starts before React has re-rendered with the
      // previous turn's committed messages.
      const {
        messages: shown,
        modelMessages: history,
        threadId: activeThreadId,
      } = useConversationStore.getState();
      const opensTheThread = shown.length === 0;

      // Ledger tools write to whatever ledger is active; re-assert it here so a
      // turn never writes into the ledger of a previously viewed thread.
      if (activeThreadId) await activateLedger(activeThreadId);

      // The transcript shows what was typed (`@juejin.cn`); the model gets the
      // same text plus the tab ids behind those mentions, resolved now rather
      // than when they were typed, so a tab closed since is reported as closed.
      const mentions = parseTabMentions(text);
      const shownText = toDisplayText(text);
      addUserMessage(shownText);
      const assistantId = startAssistantMessage();
      setStreaming(true);

      // The first question of a conversation binds to whatever the user is
      // looking at now; later ones stay on that tab even if focus moved, so a
      // multi-step task isn't derailed by glancing at another tab.
      try {
        const session = opensTheThread ? await bindToActiveTab() : await ensureSession();
        agentTabTracker.beginTurn(session.getTabId());
      } catch {
        agentTabTracker.beginTurn(getBoundTabId());
      }

      const pages = mentions.length ? await listPages() : [];
      const peeks = mentions.length ? await peekMentionedTabs(mentions) : new Map();
      const context = mentions.length
        ? buildTabContext(mentions, pages, {
            boundPageId: getBoundTabId(),
            peeks,
          })
        : null;
      const prompt = context ? `${shownText}\n\n${context}` : shownText;

      try {
        for await (const event of runAgentTurn(settings, history, prompt, signal)) {
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
              // History keeps the resolved form: next turn's model should still
              // be able to see which tab @juejin.cn meant.
              commitTurn(prompt, event.responseMessages);
              console.debug('[pagehand] turn ended', event.stop);
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
