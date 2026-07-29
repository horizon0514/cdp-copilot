import { DisplayToolCall } from '../state/conversationStore';

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function ToolCallCard({ call }: { call: DisplayToolCall }) {
  return (
    <details className="tool-call-card">
      <summary>
        <code>{call.name}</code>
        <span className={`status-badge ${call.status}`}>{call.status}</span>
      </summary>
      <pre>{stringify(call.args)}</pre>
      {call.status === 'done' && <pre>{stringify(call.result)}</pre>}
      {call.status === 'error' && <pre>{call.error}</pre>}
    </details>
  );
}
