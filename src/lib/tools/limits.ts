/**
 * Size caps for tool results whose payload the page controls. Snapshots and
 * screenshots already have their own limits; these cover the two tools that
 * could otherwise return unbounded text straight into the context window.
 */

export const MAX_EVALUATE_CHARS = 8_000;
export const MAX_BODY_CHARS = 20_000;

export interface ClampedText {
  text: string;
  truncated: boolean;
}

export function clampText(text: string, maxChars: number): ClampedText {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}… [truncated ${text.length - maxChars} of ${text.length} chars]`,
    truncated: true,
  };
}

/**
 * Keep a JSON-serializable value as-is when small; replace it with a truncated
 * JSON string when oversized, so the model still sees the head of the data.
 */
export function clampJsonValue(
  value: unknown,
  maxChars: number,
): { value: unknown; truncated: boolean } {
  const serialized = JSON.stringify(value);
  // undefined and other non-serializable values have no size to speak of.
  if (serialized === undefined || serialized.length <= maxChars) {
    return { value, truncated: false };
  }
  return { value: clampText(serialized, maxChars).text, truncated: true };
}
