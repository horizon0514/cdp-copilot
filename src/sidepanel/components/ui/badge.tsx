import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/** Soft-tinted, not solid fills — solid status blocks read as cheap at this size. */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-xs px-1.5 py-px text-[10px] font-medium tracking-[0.01em] whitespace-nowrap tabular-nums',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-hover text-fg-secondary',
        accent: 'bg-accent-soft text-accent-text',
        positive: 'bg-positive-soft text-positive',
        caution: 'bg-caution-soft text-caution',
        negative: 'bg-negative-soft text-negative',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
