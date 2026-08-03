import { describe, expect, it } from 'vitest';
import { toolOutputPreview } from './toolOutputPreview';

describe('toolOutputPreview', () => {
  it('returns short text unchanged', () => {
    expect(toolOutputPreview('a\nb\nc', 8)).toEqual({
      text: 'a\nb\nc',
      omittedLines: 0,
      truncatedByChars: false,
    });
  });

  it('keeps the newest lines', () => {
    const text = Array.from({ length: 12 }, (_, i) => `L${i + 1}`).join('\n');
    expect(toolOutputPreview(text, 4)).toEqual({
      text: 'L9\nL10\nL11\nL12',
      omittedLines: 8,
      truncatedByChars: false,
    });
  });

  it('tails by chars when a kept slice is still huge', () => {
    const huge = 'x'.repeat(100);
    const out = toolOutputPreview(huge, 8, 20);
    expect(out.text).toBe('x'.repeat(20));
    expect(out.omittedLines).toBe(0);
    expect(out.truncatedByChars).toBe(true);
  });
});
