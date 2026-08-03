import { useCallback, useEffect, useRef, useState } from 'react';
import { listPages, type PageInfo } from '../../lib/pages/PageManager';
import { filterPages, findActiveMention, insertMention } from '../../lib/pages/tabMentions';

const MAX_VISIBLE = 6;

export interface TabMentions {
  open: boolean;
  items: PageInfo[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  choose: (page: PageInfo) => void;
  close: () => void;
  /** Call from the textarea's caret-moving events to re-read the mention. */
  sync: () => void;
  /** Returns true when the menu consumed the key and the composer should not. */
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

/**
 * Drives the @-mention menu for the composer. Kept out of the component so the
 * textarea's key handling stays a single readable branch: the menu gets first
 * refusal on the navigation keys, and Enter only sends when it isn't open.
 */
export function useTabMentions(
  input: string,
  setInput: (value: string) => void,
  inputRef: React.RefObject<HTMLTextAreaElement | null>,
): TabMentions {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Where the caret was when the menu last read the text. */
  const caretRef = useRef(0);
  /** Set when the user dismisses with Esc, so it doesn't spring back open. */
  const dismissedAt = useRef<number | null>(null);

  const items = query === null ? [] : filterPages(pages, query).slice(0, MAX_VISIBLE);
  const open = query !== null && items.length > 0;

  const close = useCallback(() => {
    setQuery(null);
    setActiveIndex(0);
  }, []);

  const sync = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    caretRef.current = caret;

    const active = findActiveMention(el.value, caret);
    if (!active) {
      dismissedAt.current = null;
      setQuery(null);
      return;
    }
    if (dismissedAt.current === active.start) return;

    dismissedAt.current = null;
    setQuery(active.query);
    setActiveIndex(0);
  }, [inputRef]);

  // Tabs move around constantly; the list is only worth reading while the menu
  // is actually open, and re-reading it as the query changes keeps it honest.
  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    void listPages().then((result) => {
      if (!cancelled) setPages(result);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const choose = useCallback(
    (page: PageInfo) => {
      const el = inputRef.current;
      if (!el) return;
      const caret = el.selectionStart ?? caretRef.current;
      const active = findActiveMention(el.value, caret);
      if (!active) return;

      const next = insertMention(el.value, active, caret, page);
      setInput(next.text);
      close();
      // The value lands on the next render, so move the caret after it does.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      });
    },
    [close, inputRef, setInput],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % items.length);
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          choose(items[activeIndex] ?? items[0]);
          return true;
        case 'Escape': {
          e.preventDefault();
          // Esc also stops a running agent from a window listener — dismissing
          // this menu must not do both, so keep the event out of its reach.
          e.stopPropagation();
          const caret = e.currentTarget.selectionStart ?? 0;
          // Remember which '@' was dismissed, or sync would reopen immediately.
          dismissedAt.current = findActiveMention(e.currentTarget.value, caret)?.start ?? null;
          close();
          return true;
        }
        default:
          return false;
      }
    },
    [activeIndex, choose, close, items, open],
  );

  // A mention token is meaningless once its text is gone.
  useEffect(() => {
    if (input === '') close();
  }, [input, close]);

  return { open, items, activeIndex, setActiveIndex, choose, close, sync, handleKeyDown };
}
