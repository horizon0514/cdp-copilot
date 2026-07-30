/**
 * Make incomplete streaming markdown parse without thrashing.
 * Closes an open fenced code block so ``` never flips the rest of the
 * document into/out of a code block on every token.
 */
export function stabilizeStreamingMarkdown(text: string): string {
  // Count fence lines that start a ``` / ~~~ block (GFM allows 3+ backticks).
  const fenceMatches = text.match(/^ {0,3}(`{3,}|~{3,})/gm);
  if (!fenceMatches || fenceMatches.length % 2 === 0) return text;
  return `${text}\n\`\`\``;
}
