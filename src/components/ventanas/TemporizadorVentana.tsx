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
  const tiempo = tiempoTranscurrido;

  const formatearTiempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;

    return `${horas.toString().padStart(2, '0')}:${minutos
      .toString()
      .padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  };

  // Determinar color del semáforo cuando está activo en base al slot actual de 15 minutos (900 segundos)
  const tiempoEnSlot = tiempo % 900;
  let semaforoColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';
  if (estado === 'activa') {
    if (tiempoEnSlot < 600) { // < 10 min
      semaforoColor = 'green';
    } else if (tiempoEnSlot < 780) { // 10 a 13 min
      semaforoColor = 'yellow';
    } else { // >= 13 min
      semaforoColor = 'red';
    }
  } else if (estado === 'pausada') {
    semaforoColor = 'yellow';
  }

  // Definir clases CSS para borde, fondo y texto
  const getSemaforoClasses = () => {
    if (estado === 'inactiva') {
      return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400';
    }
    if (estado === 'finalizada') {
      return 'border-slate-300 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500';
    }
    if (semaforoColor === 'green') {
      return 'border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-300';
    }
    if (semaforoColor === 'yellow') {
      return 'border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300';
    }
    return 'border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/10 text-rose-800 dark:text-rose-300';
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-500 shadow-sm',
        getSemaforoClasses(),
        className
      )}
    >
      {/* Casing del Semáforo */}
      {(estado === 'activa' || estado === 'pausada') ? (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 dark:bg-slate-950 rounded-full border border-slate-700/50 shadow-inner mb-4 transition-all duration-500">
          {/* Rojo */}
          <div
            className={cn(
              "w-4 h-4 rounded-full transition-all duration-500 ease-out",
              semaforoColor === 'red'
                ? "bg-rose-500 shadow-[0_0_14px_6px_rgba(244,63,94,0.6)] scale-110"
                : "bg-rose-950/40 opacity-30"
            )}
          />
          {/* Amarillo */}
          <div
            className={cn(
              "w-4 h-4 rounded-full transition-all duration-500 ease-out",
              semaforoColor === 'yellow'
                ? "bg-amber-400 shadow-[0_0_14px_6px_rgba(251,191,36,0.6)] scale-110"
                : "bg-amber-950/40 opacity-30"
            )}
          />
          {/* Verde */}
          <div
            className={cn(
              "w-4 h-4 rounded-full transition-all duration-500 ease-out",
              semaforoColor === 'green'
                ? "bg-emerald-500 shadow-[0_0_14px_6px_rgba(16,185,129,0.6)] scale-110"
                : "bg-emerald-950/40 opacity-30"
            )}
          />
        </div>
      ) : (
        <Clock
          className={cn(
            'h-8 w-8 mb-4',
            estado === 'inactiva' && 'text-slate-400 dark:text-slate-500',
            estado === 'finalizada' && 'text-slate-300 dark:text-slate-600'
          )}
        />
      )}

      {/* Reloj Digital */}
      <div className={cn(
        'text-4xl font-mono font-bold tracking-wider tabular-nums transition-colors duration-500',
        estado === 'inactiva' && 'text-slate-600 dark:text-slate-300',
        estado === 'finalizada' && 'text-slate-400 dark:text-slate-500',
        estado === 'activa' && semaforoColor === 'green' && 'text-emerald-600 dark:text-emerald-400',
        estado === 'activa' && semaforoColor === 'yellow' && 'text-amber-600 dark:text-amber-400',
        estado === 'activa' && semaforoColor === 'red' && 'text-rose-600 dark:text-rose-400',
        estado === 'pausada' && 'text-amber-500 dark:text-amber-400 animate-pulse'
      )}>
        {formatearTiempo(tiempo)}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium uppercase tracking-wider">
        {estado === 'pausada' ? 'Tiempo Pausado' : 'Tiempo Transcurrido'}
      </p>

      {/* Barra de Progreso y Mensaje Informativo */}
      {(estado === 'activa' || estado === 'pausada') && (
        <div className="w-full mt-4 space-y-2">
          <div className="w-full bg-slate-200 dark:bg-slate-700/50 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                semaforoColor === 'green' && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
                semaforoColor === 'yellow' && "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
                semaforoColor === 'red' && "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
              )}
              style={{ width: `${Math.min(100, (tiempoEnSlot / 900) * 100)}%` }}
            />
          </div>
          <p className={cn(
            "text-[10px] font-semibold text-center uppercase tracking-wide",
            semaforoColor === 'green' && "text-emerald-600 dark:text-emerald-400",
            semaforoColor === 'yellow' && "text-amber-600 dark:text-amber-400",
            semaforoColor === 'red' && "text-rose-600 dark:text-rose-400"
          )}>
            {semaforoColor === 'green' && '● Estado Óptimo (Menos de 10 min)'}
            {semaforoColor === 'yellow' && '▲ Atención Finalizando (10 a 13 min)'}
            {semaforoColor === 'red' && '■ Tiempo Crítico - Cierre Inminente'}
          </p>
        </div>
      )}
    </div>
  );
}