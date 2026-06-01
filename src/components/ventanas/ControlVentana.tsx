'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Boton } from '@/components/ui/Boton';
import { Badge } from '@/components/ui/Badge';
import { Play, Pause, Square, Clock, SkipForward } from 'lucide-react';
import { TemporizadorVentana } from './TemporizadorVentana';

interface ControlVentanaProps {
  estado: 'inactiva' | 'activa' | 'pausada' | 'finalizada';
  tiempoTranscurrido?: number;
  onIniciar?: () => void;
  onPausar?: () => void;
  onReanudar?: () => void;
  onFinalizar?: () => void;
  onSaltarTurno?: () => void;
  className?: string;
  subEstado?: 'esperando_llamado' | 'en_atencion' | 'esperando_turno' | 'inactiva' | 'pausada' | 'finalizada';
  docenteEnTurno?: { nombre: string; posicion: number } | null;
}

export function ControlVentana({
  estado,
  tiempoTranscurrido = 0,
  onIniciar,
  onPausar,
  onReanudar,
  onFinalizar,
  onSaltarTurno,
  className,
  subEstado,
  docenteEnTurno,
}: ControlVentanaProps) {
  return (
    <Card className={className}>
      <Card.Header>
        <div className="flex items-center justify-between">
          <Card.Title className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Control de Ventana
          </Card.Title>
          <Badge
            variant={
              estado === 'activa'
                ? subEstado === 'en_atencion'
                  ? 'success'
                  : subEstado === 'esperando_turno'
                  ? 'default'
                  : 'warning'
                : estado === 'pausada'
                ? 'default'
                : estado === 'finalizada'
                ? 'secondary'
                : 'outline'
            }
          >
            {estado === 'activa'
              ? subEstado === 'en_atencion'
                ? 'EN ATENCIÓN'
                : subEstado === 'esperando_turno'
                ? 'ESPERANDO SIGUIENTE TURNO'
                : 'LLAMANDO A COLA'
              : estado.toUpperCase()}
          </Badge>
        </div>
      </Card.Header>
      <Card.Content className="space-y-4">
        <TemporizadorVentana
          tiempoTranscurrido={tiempoTranscurrido}
          estado={estado}
        />

        {estado === 'activa' && subEstado && (
          <div className="space-y-3">
            {subEstado === 'esperando_llamado' && docenteEnTurno && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-800 dark:text-amber-300 space-y-1 shadow-sm">
                <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  Llamando a Docente en Cola
                </p>
                <p className="text-xs font-semibold">
                  Turno actual: Posición #{docenteEnTurno.posicion} - <span className="font-bold">{docenteEnTurno.nombre}</span>
                </p>
                <p className="text-[11px] opacity-90 mt-1">
                  El docente se encuentra en cola para ser llamado. Haga clic en el botón de &apos;Llamar&apos; para iniciar su atención.
                </p>
              </div>
            )}
            {subEstado === 'en_atencion' && docenteEnTurno && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-800 dark:text-emerald-300 space-y-1 shadow-sm">
                <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Docente en Atención
                </p>
                <p className="text-xs font-semibold">
                  Atendiendo a: <span className="font-bold">{docenteEnTurno.nombre}</span> (Posición #{docenteEnTurno.posicion})
                </p>
                <p className="text-[11px] opacity-90 mt-1">
                  El docente está seleccionando sus asignaturas y horarios en el workspace.
                </p>
              </div>
            )}
            {subEstado === 'esperando_turno' && (
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm text-blue-800 dark:text-blue-300 space-y-1 shadow-sm">
                <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-50"></span>
                  Esperando Siguiente Turno
                </p>
                <p className="text-xs font-semibold">
                  Atención finalizada con éxito.
                </p>
                <p className="text-[11px] opacity-90 mt-1">
                  La ranura de 15 minutos actual sigue en curso. Debe esperar a que termine para poder llamar al siguiente docente en la cola.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {estado === 'inactiva' && (
            <Boton
              onClick={onIniciar}
              className="col-span-2 gap-2"
              variant="default"
            >
              <Play className="h-4 w-4" />
              Iniciar Ventana
            </Boton>
          )}

          {estado === 'activa' && (
            <>
              <Boton onClick={onPausar} variant="outline" className="gap-2">
                <Pause className="h-4 w-4" />
                Pausar
              </Boton>
              <Boton
                onClick={onFinalizar}
                variant="destructive"
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Finalizar
              </Boton>
              <Boton
                onClick={onSaltarTurno}
                variant="outline"
                className="col-span-2 gap-2 mt-2 border-amber-500/50 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
              >
                <SkipForward className="h-4 w-4" />
                Saltar Turno (15 min)
              </Boton>
            </>
          )}

          {estado === 'pausada' && (
            <>
              <Boton onClick={onReanudar} variant="default" className="gap-2">
                <Play className="h-4 w-4" />
                Reanudar
              </Boton>
              <Boton
                onClick={onFinalizar}
                variant="destructive"
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Finalizar
              </Boton>
            </>
          )}

          {estado === 'finalizada' && (
            <div className="col-span-2 text-center py-4 text-gray-500">
              Ventana finalizada
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}