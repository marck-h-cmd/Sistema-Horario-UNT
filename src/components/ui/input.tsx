'use client';

import * as React from 'react';
import { cn } from '@/lib/utilidades';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(props, ref) {
    const { className, type, ...rest } = props;
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ring-offset-background transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:border-unt-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-unt-blue/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-unt-gold',
          className
        )}
        ref={ref}
        {...rest}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };