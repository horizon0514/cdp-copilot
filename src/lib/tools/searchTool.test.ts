import { describe, it, expect } from 'vitest';
import { bingSearchUrl, formatSearchResults, type RawResult } from './searchTool';

describe('bingSearchUrl', () => {
  it('encodes the query, including CJK and spaces', () => {
    expect(bingSearchUrl('杭州 二手房 2026')).toBe(
      'https://www.bing.com/search?q=%E6%9D%AD%E5%B7%9E%20%E4%BA%8C%E6%89%8B%E6%88%BF%202026',
    );
  });
});

describe('formatSearchResults', () => {
  const raw: RawResult[] = [
    { title: 'First result', url: 'https://a.com', snippet: 'about a' },
    { title: 'Second result', url: 'https://b.com', snippet: 'about b' },
    { title: 'Dup of first', url: 'https://a.com', snippet: 'again a' },
    { title: '', url: 'https://c.com', snippet: 'no title' },
    { title: 'No url', url: '', snippet: 'no url' },
  ];

  it('ranks, dedupes by url, and drops entries missing title or url', () => {
    const out = formatSearchResults(raw, 10);
    expect(out.map((r) => r.url)).toEqual(['https://a.com', 'https://b.com']);
    expect(out[0].rank).toBe(1);
    expect(out[1].rank).toBe(2);
  });

  it('caps the number of results', () => {
    const out = formatSearchResults(raw, 1);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://a.com');
  });

  it('clamps overly long snippets and collapses whitespace', () => {
    const out = formatSearchResults(
      [{ title: 'x', url: 'https://x.com', snippet: `lots   of\n\nspace ${'y'.repeat(400)}` }],
      5,
    );
    expect(out[0].snippet).not.toContain('\n');
    expect(out[0].snippet.length).toBeLessThanOrEqual(301);
    expect(out[0].snippet.endsWith('…')).toBe(true);
  });
});
