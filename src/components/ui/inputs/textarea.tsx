'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'w-full rounded-3xl border border-gray-300 px-5 py-3 text-left text-sm text-gray-800 shadow-theme-xs resize-none',
          'placeholder:text-sm placeholder:text-gray-400',
          'focus:border-indigo-500 focus:outline-0 focus:ring-3 focus:ring-indigo-500/20',
          'dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-indigo-500',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
