import { describe, expect, it } from 'vitest';
import {
  buildTabContext,
  filterPages,
  findActiveMention,
  insertMention,
  labelForPage,
  parseTabMentions,
  toDisplayText,
} from './tabMentions';
import type { PageInfo } from './PageManager';

const page = (pageId: number, url: string, title: string): PageInfo => ({
  pageId,
  url,
  title,
  active: false,
  attached: false,
});

describe('findActiveMention', () => {
  it('opens on an @ at a word boundary and tracks what follows it', () => {
    expect(findActiveMention('compare with @jue', 17)).toEqual({ start: 13, query: 'jue' });
    expect(findActiveMention('@', 1)).toEqual({ start: 0, query: '' });
  });

  it('ignores an @ inside a word, so email addresses do not open it', () => {
    expect(findActiveMention('mail me@example.com', 19)).toBeNull();
  });

  it('closes once the query runs into whitespace', () => {
    expect(findActiveMention('@juejin and then', 16)).toBeNull();
  });

  it('reads the mention at the caret, not the last one in the text', () => {
    const text = '@first @second';
    expect(findActiveMention(text, 6)).toEqual({ start: 0, query: 'first' });
    expect(findActiveMention(text, 14)).toEqual({ start: 7, query: 'second' });
  });
});

describe('insertMention', () => {
  it('replaces the typed query with a token and leaves the caret past it', () => {
    const text = 'compare with @jue rest';
    const active = findActiveMention(text, 17)!;
    const result = insertMention(text, active, 17, page(42, 'https://juejin.cn/x', 'Juejin'));

    expect(result.text).toBe('compare with @[juejin.cn](tab:42)  rest');
    expect(result.text.slice(result.caret)).toBe(' rest');
    expect(parseTabMentions(result.text)).toEqual([{ pageId: 42, label: 'juejin.cn' }]);
  });

  it('survives a title full of brackets', () => {
    const inserted = insertMention('@', { start: 0, query: '' }, 1, page(7, 'not a url', '[Draft] (v2)'));
    expect(parseTabMentions(inserted.text)).toEqual([{ pageId: 7, label: 'Draft v2' }]);
  });
});

describe('toDisplayText', () => {
  it('shows the label the user picked, not the machinery', () => {
    expect(toDisplayText('diff @[juejin.cn](tab:42) against this')).toBe(
      'diff @juejin.cn against this',
    );
  });
});

describe('parseTabMentions', () => {
  it('deduplicates a tab mentioned twice', () => {
    expect(parseTabMentions('@[a](tab:1) then @[a](tab:1) and @[b](tab:2)')).toEqual([
      { pageId: 1, label: 'a' },
      { pageId: 2, label: 'b' },
    ]);
  });
});

describe('labelForPage', () => {
  it('prefers the host, falling back to the title for non-URLs', () => {
    expect(labelForPage({ url: 'https://juejin.cn/post/1', title: 'Post' })).toBe('juejin.cn');
    expect(labelForPage({ url: 'about:blank', title: 'New Tab' })).toBe('New Tab');
  });
});

describe('filterPages', () => {
  const pages = [page(1, 'https://juejin.cn/', 'Juejin'), page(2, 'https://github.com/', 'GitHub')];

  it('matches on title or url, case-insensitively', () => {
    expect(filterPages(pages, 'git').map((p) => p.pageId)).toEqual([2]);
    expect(filterPages(pages, 'JUEJIN').map((p) => p.pageId)).toEqual([1]);
    expect(filterPages(pages, '  ')).toHaveLength(2);
  });
});

describe('buildTabContext', () => {
  it('tells the model not to switch tabs just because of a mention', () => {
    const context = buildTabContext(
      [{ pageId: 42, label: 'juejin.cn' }],
      [page(42, 'https://juejin.cn/post/1', 'A Post')],
      { boundPageId: 7 },
    );

    expect(context).toContain('pageId 42');
    expect(context).toContain('https://juejin.cn/post/1');
    expect(context).toContain('bound to pageId 7');
    expect(context).toContain('Do NOT call select_page just because');
  });

  it('inlines peeked page text when provided', () => {
    const context = buildTabContext(
      [{ pageId: 42, label: 'juejin.cn' }],
      [page(42, 'https://juejin.cn/post/1', 'A Post')],
      { boundPageId: 7, peeks: new Map([[42, 'Hello from the page']]) },
    );
    expect(context).toContain('Page text:');
    expect(context).toContain('Hello from the page');
  });

  it('says so when the referenced tab has since been closed', () => {
    const context = buildTabContext([{ pageId: 42, label: 'juejin.cn' }], [], { boundPageId: null });
    expect(context).toContain('no longer open');
  });

  it('is absent when nothing was referenced', () => {
    expect(buildTabContext([], [])).toBeNull();
  });
});
