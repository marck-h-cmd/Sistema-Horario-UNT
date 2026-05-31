import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-700/80 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="page-title text-balance">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
