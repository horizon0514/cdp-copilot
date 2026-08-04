import type { DisplayMessage, DisplayPart, DisplayToolCall } from '../state/types';

export type MessageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'tools'; calls: DisplayToolCall[] };

/**
 * Resolve the render timeline for an assistant message.
 * New messages record text/tool order in `parts`; legacy threads only have
 * flat `text` + `toolCalls`, so we fall back to tools-then-text (old UI).
 */
export function resolveParts(message: DisplayMessage): DisplayPart[] {
  if (message.parts && message.parts.length > 0) return message.parts;

  const parts: DisplayPart[] = [];
  for (const call of message.toolCalls) {
    parts.push({ type: 'tool', id: call.id });
  }
  if (message.text) parts.push({ type: 'text', text: message.text });
  return parts;
}

/** Collapse consecutive tool parts into one tools segment; text stays as-is. */
export function buildMessageSegments(message: DisplayMessage): MessageSegment[] {
  const parts = resolveParts(message);
  const byId = new Map(message.toolCalls.map((call) => [call.id, call]));
  const segments: MessageSegment[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'text') {
      if (part.text.length > 0) segments.push({ kind: 'text', text: part.text });
      continue;
    }

    const calls: DisplayToolCall[] = [];
    while (i < parts.length && parts[i].type === 'tool') {
      const call = byId.get((parts[i] as { type: 'tool'; id: string }).id);
      if (call) calls.push(call);
      i += 1;
    }
    i -= 1;
    if (calls.length > 0) segments.push({ kind: 'tools', calls });
  }

  return segments;
}
