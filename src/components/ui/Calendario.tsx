'use client';

import * as React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Boton } from './Boton';
import { cn } from '@/lib/utilidades';

interface CalendarioProps {
  fechaSeleccionada?: Date;
  onSeleccionarFecha?: (fecha: Date) => void;
  className?: string;
}

export function Calendario({
  fechaSeleccionada,
  onSeleccionarFecha,
  className,
}: CalendarioProps) {
  const [mesActual, setMesActual] = React.useState(new Date());

  const inicioMes = startOfMonth(mesActual);
  const finMes = endOfMonth(mesActual);
  const diasMes = eachDayOfInterval({ start: inicioMes, end: finMes });

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const mesAnterior = () => {
    setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1));
  };

  const mesSiguiente = () => {
    setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1));
  };

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900', className)}>
      <div className="mb-4 flex items-center justify-between">
        <Boton variant="ghost" size="icon" onClick={mesAnterior}>
          <ChevronLeft className="h-4 w-4" />
        </Boton>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {format(mesActual, 'MMMM yyyy', { locale: es })}
        </h2>
        <Boton variant="ghost" size="icon" onClick={mesSiguiente}>
          <ChevronRight className="h-4 w-4" />
        </Boton>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {diasSemana.map((dia) => (
          <div
            key={dia}
            className="text-center text-xs font-medium text-gray-500 dark:text-slate-400"
          >
            {dia}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {diasMes.map((dia) => {
          const esHoy = isToday(dia);
          const estaSeleccionado = fechaSeleccionada && isSameDay(dia, fechaSeleccionada);

          return (
            <button
              key={dia.toString()}
              onClick={() => onSeleccionarFecha?.(dia)}
              className={cn(
                'aspect-square rounded-md p-0 text-sm text-slate-800 transition-colors hover:bg-gray-100 dark:text-slate-100 dark:hover:bg-slate-800',
                esHoy && 'font-bold text-primary-600',
                estaSeleccionado && 'bg-primary-600 text-white hover:bg-primary-700',
                !isSameMonth(dia, mesActual) && 'text-gray-400 dark:text-slate-600'
              )}
            >
              {format(dia, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}