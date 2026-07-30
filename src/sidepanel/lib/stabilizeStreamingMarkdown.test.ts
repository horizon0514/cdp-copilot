import { describe, expect, it } from 'vitest';
import { stabilizeStreamingMarkdown } from './stabilizeStreamingMarkdown';

describe('stabilizeStreamingMarkdown', () => {
  it('leaves complete markdown alone', () => {
    const text = 'Hello\n\n```js\nconst x = 1\n```\n\nDone.';
    expect(stabilizeStreamingMarkdown(text)).toBe(text);
  });

  it('closes an open fence so the parser does not swallow following text', () => {
    const text = 'Intro\n\n```ts\nconst x =';
    expect(stabilizeStreamingMarkdown(text)).toBe(`${text}\n\`\`\``);
  });

  it('ignores inline backticks', () => {
    const text = 'Use `code` here';
    expect(stabilizeStreamingMarkdown(text)).toBe(text);
  });
});
