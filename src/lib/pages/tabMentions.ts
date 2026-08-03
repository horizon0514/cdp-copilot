import type { PageInfo } from './PageManager';

/**
 * An @-mention carries a tab id the user picked, so the model doesn't have to
 * guess which of twelve open tabs "the docs page" meant. The id travels in the
 * text itself rather than alongside it, because the composer is a plain
 * textarea — anything held on the side desynchronises the moment the user
 * edits, reorders, or deletes part of what they typed.
 */
const MENTION = /@\[([^\]]*)\]\(tab:(\d+)\)/g;

export interface TabMention {
  pageId: number;
  label: string;
}

/** What the user typed, minus the machinery: `@[juejin.cn](tab:42)` → `@juejin.cn`. */
export function toDisplayText(text: string): string {
  return text.replace(MENTION, (_, label: string) => `@${label}`);
}

export function parseTabMentions(text: string): TabMention[] {
  const seen = new Set<number>();
  const mentions: TabMention[] = [];
  for (const [, label, id] of text.matchAll(MENTION)) {
    const pageId = Number(id);
    if (seen.has(pageId)) continue;
    seen.add(pageId);
    mentions.push({ pageId, label });
  }
  return mentions;
}

/** Brackets would break the token that carries the label. */
function safeLabel(label: string): string {
  return label.replace(/[[\]()]/g, '').trim();
}

export function mentionToken(pageId: number, label: string): string {
  return `@[${safeLabel(label) || `tab-${pageId}`}](tab:${pageId})`;
}

/** Short, stable, and what a person recognises a tab by. */
export function labelForPage(page: Pick<PageInfo, 'url' | 'title'>): string {
  try {
    const host = new URL(page.url).host;
    if (host) return host;
  } catch {
    // Not a URL we can parse (chrome://, about:blank) — fall back to the title.
  }
  return page.title || 'tab';
}

export interface ActiveMention {
  /** Index of the `@`. */
  start: number;
  query: string;
}

/**
 * The mention being typed at the caret, if any. An `@` only opens the menu at a
 * word boundary, so email addresses and `a@b` don't trigger it.
 */
export function findActiveMention(text: string, caret: number): ActiveMention | null {
  for (let i = caret - 1; i >= 0; i--) {
    const char = text[i];
    if (char === '@') {
      const before = i > 0 ? text[i - 1] : ' ';
      if (!/\s/.test(before)) return null;
      return { start: i, query: text.slice(i + 1, caret) };
    }
    // A mention query is a single run of non-space characters.
    if (/\s/.test(char)) return null;
  }
  return null;
}

export function insertMention(
  text: string,
  active: ActiveMention,
  caret: number,
  page: PageInfo,
): { text: string; caret: number } {
  const token = `${mentionToken(page.pageId, labelForPage(page))} `;
  return {
    text: text.slice(0, active.start) + token + text.slice(caret),
    caret: active.start + token.length,
  };
}

export function filterPages(pages: PageInfo[], query: string): PageInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages;
  return pages.filter(
    (p) => p.title.toLowerCase().includes(q) || p.url.toLowerCase().includes(q),
  );
}

/**
 * The block appended to what the model sees. It states the facts and stops
 * there: whether to switch pages stays the model's call, made with select_page
 * like any other, rather than something the composer did behind its back.
 */
export function buildTabContext(mentions: TabMention[], pages: PageInfo[]): string | null {
  if (mentions.length === 0) return null;

  const lines = mentions.map((mention) => {
    const page = pages.find((p) => p.pageId === mention.pageId);
    if (!page) return `- @${mention.label} — that tab is no longer open.`;
    return `- @${mention.label} — pageId ${page.pageId}, ${JSON.stringify(page.title)}, ${page.url}`;
  });

  return [
    'Tabs referenced above:',
    ...lines,
    'Call select_page with a pageId to work on one of them.',
  ].join('\n');
}
