import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utilidades';

const botonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-[1.03] active:scale-[0.97] select-none',
  {
    variants: {
      variant: {
        // ── Base variants ─────────────────────────────────────────────────────
        default:
          'bg-gradient-to-b from-primary-500 to-primary-700 text-white shadow-md shadow-primary-500/30 hover:from-primary-400 hover:to-primary-600 hover:shadow-lg hover:shadow-primary-500/40 focus-visible:ring-primary-500',

        destructive:
          'bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-md shadow-rose-500/30 hover:from-rose-400 hover:to-rose-600 hover:shadow-lg hover:shadow-rose-500/40 focus-visible:ring-rose-500',

        outline:
          'border-2 border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 focus-visible:ring-slate-400',

        secondary:
          'bg-gradient-to-b from-slate-100 to-slate-200 text-slate-800 border border-slate-300 shadow-sm hover:from-slate-50 hover:to-slate-100 hover:shadow-md dark:from-slate-800 dark:to-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:from-slate-700 dark:hover:to-slate-800 focus-visible:ring-slate-400',

        ghost:
          'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 focus-visible:ring-slate-400',

        link: 'text-primary underline-offset-4 hover:underline focus-visible:ring-primary-500',

        // ── Vibrant action variants — soft-tinted at rest, solid on hover ──
        edit:
          'bg-blue-50 text-blue-600 border border-blue-200/80 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-md hover:shadow-blue-500/20 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/40 dark:hover:bg-blue-600 dark:hover:text-white',

        view:
          'bg-violet-50 text-violet-600 border border-violet-200/80 hover:bg-violet-600 hover:text-white hover:border-violet-600 hover:shadow-md hover:shadow-violet-500/20 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-800/40 dark:hover:bg-violet-600 dark:hover:text-white',

        warning:
          'bg-amber-50 text-amber-600 border border-amber-200/80 hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-md hover:shadow-amber-500/20 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/40 dark:hover:bg-amber-500 dark:hover:text-white',

        danger:
          'bg-rose-50 text-rose-600 border border-rose-200/80 hover:bg-rose-600 hover:text-white hover:border-rose-600 hover:shadow-md hover:shadow-rose-500/20 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800/40 dark:hover:bg-rose-600 dark:hover:text-white',

        success:
          'bg-emerald-50 text-emerald-600 border border-emerald-200/80 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40 dark:hover:bg-emerald-600 dark:hover:text-white',

        info:
          'bg-sky-50 text-sky-600 border border-sky-200/80 hover:bg-sky-650 hover:text-white hover:border-sky-650 hover:shadow-md hover:shadow-sky-500/20 dark:bg-sky-950/20 dark:text-sky-405 dark:border-sky-800/40 dark:hover:bg-sky-600 dark:hover:text-white',

        teal:
          'bg-teal-50 text-teal-600 border border-teal-200/80 hover:bg-teal-600 hover:text-white hover:border-teal-600 hover:shadow-md hover:shadow-teal-500/20 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-800/40 dark:hover:bg-teal-600 dark:hover:text-white',

        indigo:
          'bg-indigo-50 text-indigo-650 border border-indigo-200/80 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-500/20 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800/40 dark:hover:bg-indigo-650 dark:hover:text-white',

        orange:
          'bg-orange-50 text-orange-650 border border-orange-200/80 hover:bg-orange-600 hover:text-white hover:border-orange-600 hover:shadow-md hover:shadow-orange-500/20 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800/40 dark:hover:bg-orange-600 dark:hover:text-white',

        pink:
          'bg-pink-50 text-pink-650 border border-pink-200/80 hover:bg-pink-600 hover:text-white hover:border-pink-600 hover:shadow-md hover:shadow-pink-500/20 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-800/40 dark:hover:bg-pink-600 dark:hover:text-white',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8 text-base',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BotonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof botonVariants> {
  asChild?: boolean;
}

const Boton = React.forwardRef<HTMLButtonElement, BotonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(botonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Boton.displayName = 'Boton';

export { Boton, botonVariants };