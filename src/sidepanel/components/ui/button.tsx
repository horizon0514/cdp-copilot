import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium tracking-[-0.01em] outline-none transition-[background-color,border-color,color,opacity] duration-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent-line [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-fg hover:bg-accent-hover',
        outline: 'border border-line bg-surface text-fg hover:bg-surface-hover hover:border-line-strong',
        ghost: 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
        subtle: 'bg-surface-hover text-fg hover:bg-surface-active',
        danger: 'bg-negative-soft text-negative hover:bg-negative-soft/80',
      },
      size: {
        default: 'h-7 px-3 text-[12.5px]',
        sm: 'h-6 px-2 text-[11.5px]',
        lg: 'h-8 px-4 text-[13px]',
        icon: 'size-7',
        'icon-sm': 'size-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
