import { useCallback } from 'react';
import { useConversationStore } from '../state/conversationStore';
import { runAgentTurn } from '../../lib/llm/agentLoop';
import { Settings } from '../../lib/storage/schema';
import { ChatMessage } from '../../lib/llm/types';

export function useAgentSession(settings: Settings | null) {
  const messages = useConversationStore((s) => s.messages);
  const isStreaming = useConversationStore((s) => s.isStreaming);
  const addUserMessage = useConversationStore((s) => s.addUserMessage);
  const startAssistantMessage = useConversationStore((s) => s.startAssistantMessage);
  const appendAssistantText = useConversationStore((s) => s.appendAssistantText);
  const addToolCall = useConversationStore((s) => s.addToolCall);
  const updateToolResult = useConversationStore((s) => s.updateToolResult);
  const updateToolError = useConversationStore((s) => s.updateToolError);
  const setMessageError = useConversationStore((s) => s.setMessageError);
  const setStreaming = useConversationStore((s) => s.setStreaming);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!settings || !text.trim()) return;

      const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.text }));
      addUserMessage(text);
      const assistantId = startAssistantMessage();
      setStreaming(true);

      try {
        for await (const event of runAgentTurn(settings, history, text)) {
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
              break;
          }
        }
      } finally {
        setStreaming(false);
      }
    },
    [
      settings,
      messages,
      addUserMessage,
      startAssistantMessage,
      appendAssistantText,
      addToolCall,
      updateToolResult,
      updateToolError,
      setMessageError,
      setStreaming,
    ],
  );

  return { messages, isStreaming, sendMessage };
}
