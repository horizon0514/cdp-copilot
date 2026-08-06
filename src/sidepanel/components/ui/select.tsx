import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-7 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-bg px-2.5 text-[12.5px] text-fg outline-none transition-colors duration-200',
        'hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent-line',
        'data-[placeholder]:text-fg-tertiary disabled:cursor-not-allowed disabled:opacity-40',
        '[&>span]:truncate',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronsUpDown className="size-3 shrink-0 text-fg-tertiary" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * Icon-only trigger, for a select that is a control rather than a field.
 *
 * No box and no chevron: those say "this is one of the things you came here to
 * fill in", which is exactly the claim being withdrawn. The current value lives
 * in the menu's checkmark, so nothing is lost by not showing it — pass an
 * `aria-label`, since the icon carries no accessible name of its own.
 */
function SelectIconTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-fg-tertiary outline-none transition-colors duration-200',
        'hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-line',
        'data-[state=open]:bg-surface-hover data-[state=open]:text-fg',
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={4}
        className={cn(
          'relative z-50 max-h-64 min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-popover)]',
          position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex h-7 w-full cursor-pointer items-center gap-2 rounded-sm pr-2 pl-7 text-[12.5px] text-fg-secondary outline-none select-none',
        'data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg',
        'data-[state=checked]:text-fg',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3 text-accent-text" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectValue, SelectTrigger, SelectIconTrigger, SelectContent, SelectItem };
