import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DisplayMessage } from '../state/conversationStore';
import ToolCallCard from './ToolCallCard';

function TypingDots() {
  return (
    <span className="typing-dots" aria-label="Thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function MessageBubble({
  message,
  isStreaming,
}: {
  message: DisplayMessage;
  isStreaming?: boolean;
}) {
  const hasText = message.text.trim().length > 0;
  const showTyping = isStreaming && message.role === 'assistant' && !hasText && message.toolCalls.length === 0;
  const showBubble = message.role === 'user' || hasText || showTyping;

  return (
    <div className={`message-row ${message.role}`}>
      {showBubble && (
        <div className={`message-bubble ${message.role}`}>
          {showTyping ? (
            <TypingDots />
          ) : message.role === 'assistant' ? (
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
              {isStreaming && hasText && <span className="typing-cursor" />}
            </div>
          ) : (
            message.text
          )}
        </div>
      )}
      {message.toolCalls.map((call) => (
        <ToolCallCard key={call.id} call={call} />
      ))}
      {message.error && <div className="banner error">{message.error}</div>}
    </div>
  );
}
