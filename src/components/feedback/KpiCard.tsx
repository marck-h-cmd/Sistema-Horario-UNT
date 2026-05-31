import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, className }: KpiCardProps) {
  return (
    <div className={cn('card', className)}>
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="kpi-value mt-1">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{subtitle}</p>}
            {trend && (
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                <span className={trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {trend.value >= 0 ? '+' : ''}
                  {trend.value}%
                </span>{' '}
                {trend.label}
              </p>
            )}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-unt-blue/10 dark:bg-slate-700">
            <Icon className="h-6 w-6 text-unt-blue dark:text-unt-gold-light" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
