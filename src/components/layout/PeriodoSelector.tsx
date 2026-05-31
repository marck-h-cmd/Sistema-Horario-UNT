'use client';

import { Calendar } from 'lucide-react';
import { usePeriodo } from '@/contexts/PeriodoContext';
import { Formateadores } from '@/lib/formateadores';
import { cn } from '@/lib/cn';

interface PeriodoSelectorProps {
  className?: string;
}

export function PeriodoSelector({ className }: PeriodoSelectorProps) {
  const { periodos, periodoSeleccionado, setPeriodoSeleccionado, loading } = usePeriodo();

  if (loading) {
    return (
      <div
        className={cn('h-9 w-48 animate-pulse rounded-md bg-gray-200 dark:bg-slate-700', className)}
      />
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Calendar className="h-4 w-4 shrink-0 text-unt-blue dark:text-unt-gold-light" />
      <select
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-unt-blue focus:outline-none focus:ring-2 focus:ring-unt-blue/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-unt-gold dark:focus:ring-unt-gold/20"
        value={periodoSeleccionado?.id || ''}
        onChange={(e) => {
          const p = periodos.find((x) => x.id === e.target.value);
          setPeriodoSeleccionado(p || null);
        }}
      >
        {periodos.length === 0 && <option value="">Sin períodos</option>}
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} ({Formateadores.estadoPeriodo(p.estado)})
          </option>
        ))}
      </select>
    </div>
  );
}
