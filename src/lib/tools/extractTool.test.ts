import { describe, it, expect } from 'vitest';
import { buildExtractionPrompt, parseModelJson, MAX_EXTRACT_SOURCE_CHARS } from './extractTool';

const page = {
  url: 'https://example.com/notes/1',
  title: 'A note',
  text: 'comment one\ncomment two',
  links: ['user-a -> https://example.com/u/a', 'user-b -> https://example.com/u/b'],
};

describe('buildExtractionPrompt', () => {
  it('carries the instruction, page identity, text and links', () => {
    const prompt = buildExtractionPrompt('all comments as [{user, text}]', page);
    expect(prompt).toContain('Extraction instruction: all comments as [{user, text}]');
    expect(prompt).toContain('Page URL: https://example.com/notes/1');
    expect(prompt).toContain('comment one');
    expect(prompt).toContain('user-a -> https://example.com/u/a');
    expect(prompt).not.toContain('was truncated');
  });

  it('clamps oversized page text and says so', () => {
    const prompt = buildExtractionPrompt('anything', {
      ...page,
      text: 'x'.repeat(MAX_EXTRACT_SOURCE_CHARS + 5000),
    });
    expect(prompt).toContain('the page text below was truncated');
    expect(prompt.length).toBeLessThan(MAX_EXTRACT_SOURCE_CHARS + 2000);
  });
});

describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('[{"user":"a"}]')).toEqual([{ user: 'a' }]);
  });

  it('parses JSON wrapped in markdown fences', () => {
    expect(parseModelJson('```json\n{"ok":true}\n```')).toEqual({ ok: true });
    expect(parseModelJson('```\n[]\n```')).toEqual([]);
  });

  it('returns undefined for prose so the tool can fall back to raw text', () => {
    expect(parseModelJson('I could not find any comments.')).toBeUndefined();
  });
});
