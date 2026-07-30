import * as React from 'react';
import { cn } from '../../lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-7 w-full rounded-md border border-line bg-bg px-2.5 text-[12.5px] text-fg outline-none transition-colors duration-200',
        'placeholder:text-fg-tertiary',
        'hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent-line',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
