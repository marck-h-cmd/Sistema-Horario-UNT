'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/cn';

interface ThemeToggleProps {
  className?: string;
  variant?: 'default' | 'ghost' | 'login';
}

export function ThemeToggle({ className, variant = 'default' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  const base =
    variant === 'login'
      ? 'theme-toggle-btn rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
      : variant === 'ghost'
        ? 'theme-toggle-btn rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        : 'theme-toggle-btn rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(base, className)}
      title="Cambiar tema"
      aria-label="Cambiar tema"
      aria-pressed={isDark}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
