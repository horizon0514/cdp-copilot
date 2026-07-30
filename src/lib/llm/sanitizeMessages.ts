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
