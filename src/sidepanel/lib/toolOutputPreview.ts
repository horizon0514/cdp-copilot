/** Default lines kept in the collapsed tool body (Claude Code–style tail). */
export const TOOL_PREVIEW_LINES = 8;
/** Cap for a single huge line / minified blob so the card stays glanceable. */
export const TOOL_PREVIEW_CHARS = 2400;

export type ToolOutputPreview = {
  text: string;
  /** Lines dropped from the start when keeping the newest slice. */
  omittedLines: number;
  /** True when the kept slice was further cut by the char budget. */
  truncatedByChars: boolean;
};

/**
 * Keep the newest slice of tool output for the default card body.
 * Prefer whole lines; fall back to a char tail when a line is enormous.
 */
export function toolOutputPreview(
  text: string,
  maxLines = TOOL_PREVIEW_LINES,
  maxChars = TOOL_PREVIEW_CHARS,
): ToolOutputPreview {
  if (!text) {
    return { text: '', omittedLines: 0, truncatedByChars: false };
  }

  const lines = text.split('\n');
  let omittedLines = 0;
  let slice = lines;
  if (lines.length > maxLines) {
    omittedLines = lines.length - maxLines;
    slice = lines.slice(-maxLines);
  }

  let preview = slice.join('\n');
  let truncatedByChars = false;
  if (preview.length > maxChars) {
    preview = preview.slice(preview.length - maxChars);
    truncatedByChars = true;
  }

  return { text: preview, omittedLines, truncatedByChars };
}
