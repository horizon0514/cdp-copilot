import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../../lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[12px] leading-none font-medium text-fg select-none', className)}
      {...props}
    />
  );
}

/** Tiny uppercase section marker — the Linear/Raycast group header. */
function SectionLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-0.5 text-[10px] font-medium tracking-[0.06em] text-fg-tertiary uppercase select-none',
        className,
      )}
      {...props}
    />
  );
}

export { Label, SectionLabel };
