import { DisplayMessage } from '../state/conversationStore';
import ToolCallCard from './ToolCallCard';

export default function MessageBubble({ message }: { message: DisplayMessage }) {
  return (
    <div>
      <div className={`message-bubble ${message.role}`}>
        {message.text || (message.role === 'assistant' && message.toolCalls.length === 0 ? '…' : '')}
      </div>
      {message.toolCalls.map((call) => (
        <ToolCallCard key={call.id} call={call} />
      ))}
      {message.error && <div className="banner error">{message.error}</div>}
    </div>
  );
}
