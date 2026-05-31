import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FormFieldProps) {
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={htmlFor} className="text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-0.5 text-unt-red">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

export const formControlClass = (hasError?: boolean) =>
  cn(
    'flex h-10 w-full rounded-lg border bg-white dark:bg-slate-700 dark:text-slate-100 px-3 text-sm shadow-sm transition-colors duration-150',
    'placeholder:text-slate-400 dark:placeholder:text-slate-500',
    'focus:border-unt-blue focus:outline-none focus:ring-2 focus:ring-unt-blue/20',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-unt-blue/40 focus-visible:ring-offset-1',
    'disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500',
    hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 dark:border-slate-600'
  );
