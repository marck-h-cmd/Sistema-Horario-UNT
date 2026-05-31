'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utilidades';

interface TemporizadorVentanaProps {
  tiempoTranscurrido: number; // en segundos
  estado: 'inactiva' | 'activa' | 'pausada' | 'finalizada';
  className?: string;
}

export function TemporizadorVentana({
  tiempoTranscurrido,
  estado,
  className,
}: TemporizadorVentanaProps) {
  const [tiempo, setTiempo] = React.useState(tiempoTranscurrido);

  React.useEffect(() => {
    setTiempo(tiempoTranscurrido);
  }, [tiempoTranscurrido]);

  React.useEffect(() => {
    if (estado !== 'activa') return;

    const intervalo = setInterval(() => {
      setTiempo((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalo);
  }, [estado]);

  const formatearTiempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;

    return `${horas.toString().padStart(2, '0')}:${minutos
      .toString()
      .padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 rounded-lg border-2',
        estado === 'activa' && 'border-green-500 bg-green-50 dark:bg-green-900/20',
        estado === 'pausada' && 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
        estado === 'inactiva' && 'border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40',
        estado === 'finalizada' && 'border-gray-400 dark:border-slate-500 bg-gray-100 dark:bg-slate-700/40',
        className
      )}
    >
      <Clock
        className={cn(
          'h-8 w-8 mb-2',
          estado === 'activa' && 'text-green-600 dark:text-green-400',
          estado === 'pausada' && 'text-yellow-600 dark:text-yellow-400',
          estado === 'inactiva' && 'text-gray-400 dark:text-slate-500',
          estado === 'finalizada' && 'text-gray-500 dark:text-slate-400'
        )}
      />
      <div className={cn(
        'text-4xl font-mono font-bold',
        estado === 'activa' && 'text-green-800 dark:text-green-300',
        estado === 'pausada' && 'text-yellow-800 dark:text-yellow-300',
        estado === 'inactiva' && 'text-gray-600 dark:text-slate-300',
        estado === 'finalizada' && 'text-gray-500 dark:text-slate-400',
      )}>
        {formatearTiempo(tiempo)}
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">Tiempo transcurrido</p>
    </div>
  );
}