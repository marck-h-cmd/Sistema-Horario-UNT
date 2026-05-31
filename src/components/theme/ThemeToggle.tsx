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
      ? 'rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
      : variant === 'ghost'
        ? 'rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        : 'rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(base, className)}
      title={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      aria-pressed={isDark}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
