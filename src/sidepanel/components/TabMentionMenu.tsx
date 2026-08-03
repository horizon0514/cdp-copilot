import { Link2 } from 'lucide-react';
import type { PageInfo } from '../../lib/pages/PageManager';
import { labelForPage } from '../../lib/pages/tabMentions';
import { cn } from '../lib/utils';

/**
 * The @-menu. Sits above the composer because the composer is already at the
 * bottom of a narrow panel — a dropdown would open off-screen.
 */
export default function TabMentionMenu({
  items,
  activeIndex,
  onHover,
  onPick,
}: {
  items: PageInfo[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (page: PageInfo) => void;
}) {
  return (
    <div
      className="absolute bottom-full left-0 z-20 mb-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-popover)]"
      role="listbox"
      aria-label="Reference a tab"
    >
      {items.map((page, i) => (
        <button
          key={page.pageId}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          // The textarea keeps focus, so the menu is driven by the keyboard
          // even while the pointer is over it — mousedown would steal it.
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(page)}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] outline-none',
            i === activeIndex ? 'bg-surface-active text-fg' : 'text-fg-secondary',
          )}
        >
          <Link2 className="size-3 shrink-0 text-fg-tertiary" aria-hidden />
          <span className="shrink-0 font-medium">{labelForPage(page)}</span>
          <span className="min-w-0 truncate text-fg-tertiary">{page.title}</span>
          {page.attached && (
            <span className="ml-auto shrink-0 text-[10px] text-positive">bound</span>
          )}
        </button>
      ))}
    </div>
  );
}
