import type { ModelMessage } from 'ai';

const DATA_URL_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;

/**
 * Strip screenshot payloads from model history so a prior take_screenshot
 * doesn't blow the next turn's context window. The model can call the tool again.
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return '[image omitted — call take_screenshot again if needed]';
    return value.replace(DATA_URL_RE, '[image omitted — call take_screenshot again if needed]');
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v)]),
    );
  }
  return value;
}

export function sanitizeModelMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message) => {
    if (typeof message.content === 'string') {
      return { ...message, content: sanitizeValue(message.content) as string } as ModelMessage;
    }
    if (!Array.isArray(message.content)) return message;

    const content = message.content.map((part) => {
      if (part.type === 'tool-result') {
        const output = part.output;
        if (output.type === 'json' || output.type === 'text' || output.type === 'error-text') {
          return {
            ...part,
            output: { ...output, value: sanitizeValue(output.value) },
          };
        }
        if (output.type === 'error-json') {
          return {
            ...part,
            output: { ...output, value: sanitizeValue(output.value) },
          };
        }
        return part;
      }
      if (part.type === 'text' && typeof part.text === 'string') {
        return { ...part, text: sanitizeValue(part.text) as string };
      }
      return part;
    });

    return { ...message, content } as ModelMessage;
  });
}

/**
 * Stopping a turn mid-step can leave an assistant tool-call with no matching
 * tool-result. Providers reject that history on the next turn (Anthropic and
 * OpenAI both require every tool call to be answered), so drop the orphans —
 * and any message left with nothing in it.
 */
export function dropDanglingToolCalls<T extends ModelMessage>(messages: T[]): T[] {
  const answered = new Set<string>();
  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === 'tool-result') answered.add(part.toolCallId);
    }
  }

  const kept: T[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      kept.push(message);
      continue;
    }
    const content = message.content.filter(
      (part) => part.type !== 'tool-call' || answered.has(part.toolCallId),
    );
    if (content.length === 0) continue;
    kept.push({ ...message, content } as T);
  }
  return kept;
}
