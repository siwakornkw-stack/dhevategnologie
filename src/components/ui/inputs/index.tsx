'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type || 'text'}
        className={cn(
          'h-12 w-full rounded-full border border-gray-300 px-5 py-2.5 text-left text-sm text-gray-800 shadow-theme-xs',
          'placeholder:text-sm placeholder:text-gray-400 disabled:opacity-70',
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

Input.displayName = 'Input';
