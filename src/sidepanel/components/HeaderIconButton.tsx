import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';

/**
 * Compact header control for the Pagehand toolbar cluster.
 * Quiet by default; lime soft-fill when active; primary actions tint on hover.
 */
export default function HeaderIconButton({
  active = false,
  emphasize = false,
  className,
  children,
  ...props
}: {
  active?: boolean;
  /** Slight accent hover — used for the primary “new chat” affordance. */
  emphasize?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-[7px] outline-none',
        'text-fg-tertiary transition-[background-color,color,transform,box-shadow] duration-150',
        'hover:bg-surface-hover hover:text-fg',
        'focus-visible:ring-2 focus-visible:ring-accent-line focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        'active:scale-[0.93]',
        'disabled:pointer-events-none disabled:opacity-35',
        active &&
          'bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_var(--accent-line)] hover:bg-accent-soft hover:text-accent-text',
        emphasize &&
          !active &&
          'hover:bg-accent-soft/80 hover:text-accent-text hover:shadow-[inset_0_0_0_1px_var(--accent-line)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
