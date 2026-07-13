'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Boton } from '@/components/ui/Boton';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Bell, UserPlus, Clock } from 'lucide-react';
import { NotificacionToast } from '@/components/ui/NotificacionToast';

interface DocenteSiguiente {
  id: string;
  nombre: string;
  email: string;
  categoria: string;
  horaLlegada: string;
  posicionCola: number;
}

interface PanelLlamarSiguienteProps {
  docenteSiguiente?: DocenteSiguiente | null;
  onLlamar?: (docente: DocenteSiguiente) => void;
  onNotificar?: (docente: DocenteSiguiente) => void;
  className?: string;
  tiempoVentana?: number;
  lastLlamadoSlot?: number | null;
}

export function PanelLlamarSiguiente({
  docenteSiguiente,
  onLlamar,
  onNotificar,
  className,
  tiempoVentana,
  lastLlamadoSlot,
}: PanelLlamarSiguienteProps) {
  const currentSlot = tiempoVentana !== undefined ? Math.floor(tiempoVentana / 900) : 0;
  const isBlocked = tiempoVentana !== undefined && lastLlamadoSlot !== undefined && lastLlamadoSlot === currentSlot;
  const secondsLeft = isBlocked ? Math.max(0, (currentSlot + 1) * 900 - tiempoVentana) : 0;

  const handleLlamar = () => {
    if (isBlocked) {
      NotificacionToast.error('Debe esperar a que finalice la ventana de atención actual.');
      return;
    }
    if (docenteSiguiente) {
      onLlamar?.(docenteSiguiente);
      NotificacionToast.exito(`Llamando a ${docenteSiguiente.nombre}`);
    }
  };

  const handleNotificar = () => {
    if (docenteSiguiente) {
      onNotificar?.(docenteSiguiente);
      NotificacionToast.info(`Notificación enviada a ${docenteSiguiente.nombre}`);
    }
  };

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!docenteSiguiente) {
    return (
      <Card className={className}>
        <Card.Content className="flex flex-col items-center justify-center py-12">
          <UserPlus className="h-16 w-16 text-gray-300 dark:text-slate-600 mb-4" />
          <p className="text-gray-500 dark:text-slate-400 text-center">
            No hay más docentes en la cola
          </p>
        </Card.Content>
      </Card>
    );
  }

  const iniciales = docenteSiguiente.nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card className={className}>
      <Card.Header>
        <Card.Title>Siguiente en Cola</Card.Title>
        <Card.Description>
          Posición #{docenteSiguiente.posicionCola}
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar fallback={iniciales} className="h-16 w-16 text-lg" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{docenteSiguiente.nombre}</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">{docenteSiguiente.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{docenteSiguiente.categoria}</Badge>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                <Clock className="h-3 w-3" />
                {docenteSiguiente.horaLlegada}
              </div>
            </div>
          </div>
        </div>

        {isBlocked && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 shadow-sm transition-all duration-300">
            <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400 animate-pulse" />
            <div>
              <p className="font-bold">Ventana de atención ocupada</p>
              <p className="mt-0.5">
                Debe respetar el tiempo de la ranura actual. Podrá llamar al siguiente en{' '}
                <span className="font-mono font-bold">{formatCountdown(secondsLeft)}</span>.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Boton
            variant="info"
            onClick={handleNotificar}
            className="gap-2"
          >
            <Bell className="h-4 w-4" />
            Notificar
          </Boton>
          <Boton
            variant="default"
            onClick={handleLlamar}
            disabled={isBlocked}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Llamar
          </Boton>
        </div>
      </Card.Content>
    </Card>
  );
}