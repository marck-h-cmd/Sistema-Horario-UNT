import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utilidades';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide border border-transparent transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary dark:text-primary-300',
        secondary: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
        destructive: 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300',
        outline: 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400',
        success: 'border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
        warning: 'border-transparent bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
        info: 'border-transparent bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
