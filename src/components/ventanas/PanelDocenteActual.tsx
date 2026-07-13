'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Boton } from '@/components/ui/Boton';
import { User, Mail, Clock, CheckCircle, XCircle } from 'lucide-react';
import { TemporizadorVentana } from './TemporizadorVentana';

interface DocenteActual {
  id: string;
  nombre: string;
  email: string;
  categoria: string;
  horaInicio: string;
  tiempoTranscurrido: number;
}

interface PanelDocenteActualProps {
  docente: DocenteActual | null;
  onFinalizar?: () => void;
  onCancelar?: () => void;
  className?: string;
}

export function PanelDocenteActual({
  docente,
  onFinalizar,
  onCancelar,
  className,
}: PanelDocenteActualProps) {
  if (!docente) {
    return (
      <Card className={className}>
        <Card.Content className="text-center py-12">
          <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No hay docente en atención</p>
        </Card.Content>
      </Card>
    );
  }

  const iniciales = docente.nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card className={className}>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Docente en Atención
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar size="lg" fallback={iniciales} />
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{docente.nombre}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Mail className="h-4 w-4" />
              {docente.email}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge>{docente.categoria}</Badge>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                Inicio: {docente.horaInicio}
              </div>
            </div>
          </div>
        </div>

        <TemporizadorVentana
          tiempoTranscurrido={docente.tiempoTranscurrido}
          estado="activa"
        />

        <div className="grid grid-cols-2 gap-2">
          <Boton
            onClick={onFinalizar}
            variant="success"
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Finalizar Atención
          </Boton>
          <Boton
            onClick={onCancelar}
            variant="danger"
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Cancelar
          </Boton>
        </div>
      </Card.Content>
    </Card>
  );
}