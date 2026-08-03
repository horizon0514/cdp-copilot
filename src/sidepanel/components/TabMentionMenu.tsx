import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { PageInfo } from '../../lib/pages/PageManager';
import { labelForPage } from '../../lib/pages/tabMentions';
import { useT } from '../i18n/useT';
import { cn } from '../lib/utils';

/** The favicon, or a globe once the tab's icon fails to load (many have none). */
function Favicon({ page }: { page: PageInfo }) {
  const [broken, setBroken] = useState(false);
  if (!page.favIconUrl || broken) {
    return <Globe className="size-3.5 shrink-0 text-fg-tertiary" aria-hidden />;
  }
  return (
    <img
      className="size-3.5 shrink-0 rounded-[3px]"
      src={page.favIconUrl}
      alt=""
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Marks where the query matched, so a row full of near-identical hosts says
 * which part of it the user is actually typing.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-accent-text">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * The @-menu. Sits above the composer because the composer is already at the
 * bottom of a narrow panel — a dropdown would open off-screen.
 */
export default function TabMentionMenu({
  items,
  query,
  activeIndex,
  onHover,
  onPick,
}: {
  items: PageInfo[];
  query: string;
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (page: PageInfo) => void;
}) {
  const t = useT();
  return (
    <div
      className="animate-enter absolute bottom-full left-0 z-20 mb-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface/95 shadow-[var(--shadow-popover)] backdrop-blur-md"
      role="listbox"
      aria-label={t('mention.title')}
    >
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1 text-[10px] tracking-[0.02em] text-fg-tertiary">
        <span className="font-medium uppercase">{t('mention.title')}</span>
        <span className="shrink-0 tabular-nums">{t('mention.hints')}</span>
      </div>

      <div className="p-1">
        {items.map((page, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={page.pageId}
              type="button"
              role="option"
              aria-selected={active}
              // The textarea keeps focus, so the menu is driven by the keyboard
              // even while the pointer is over it — mousedown would steal it.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(page)}
              className={cn(
                'relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-2 pl-2.5 text-left text-[11.5px] outline-none',
                'transition-colors duration-100',
                active ? 'bg-accent-soft text-fg' : 'text-fg-secondary',
              )}
            >
              {/* The selected row is a target, not just a tint — say so on its edge. */}
              <span
                className={cn(
                  'absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent',
                  active ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
              <Favicon page={page} />
              <span className="shrink-0 font-medium">
                <Highlight text={labelForPage(page)} query={query} />
              </span>
              <span className="min-w-0 flex-1 truncate text-fg-tertiary">
                <Highlight text={page.title} query={query} />
              </span>
              {page.attached && (
                <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-positive">
                  <span className="size-1.5 rounded-full bg-positive" aria-hidden />
                  {t('mention.bound')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
