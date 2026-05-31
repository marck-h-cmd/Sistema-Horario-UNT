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
}

export function PanelLlamarSiguiente({
  docenteSiguiente,
  onLlamar,
  onNotificar,
  className,
}: PanelLlamarSiguienteProps) {
  const handleLlamar = () => {
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

        <div className="grid grid-cols-2 gap-2">
          <Boton
            variant="outline"
            onClick={handleNotificar}
            className="gap-2"
          >
            <Bell className="h-4 w-4" />
            Notificar
          </Boton>
          <Boton
            variant="default"
            onClick={handleLlamar}
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