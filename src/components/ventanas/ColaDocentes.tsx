'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TarjetaDocenteCola } from './TarjetaDocenteCola';
import { Users, Clock } from 'lucide-react';

interface Docente {
  id: string;
  atencionId: string;
  nombre: string;
  email: string;
  categoria: string;
  horaLlegada: string;
  prioridad?: 'normal' | 'alta' | 'urgente';
  estado?: string;
  observaciones?: any;
  justificacionConfirmada?: boolean;
  fechaIngreso?: string | null;
}

interface ColaDocentesProps {
  docentes: Docente[];
  ventanaId: string;
  onJustificacionConfirmada?: (atencionId: string) => void;
  onSeleccionarDocente?: (docente: Docente) => void;
  className?: string;
}

export function ColaDocentes({
  docentes,
  ventanaId,
  onJustificacionConfirmada,
  onSeleccionarDocente,
  className,
}: ColaDocentesProps) {
  return (
    <Card className={className}>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Cola de Espera
        </Card.Title>
        <Card.Description>
          {docentes.length} docente{docentes.length !== 1 ? 's' : ''} en cola
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {docentes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay docentes en cola</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {docentes.map((docente, index) => (
              <TarjetaDocenteCola
                key={docente.id}
                docente={docente}
                posicion={index + 1}
                ventanaId={ventanaId}
                onJustificacionConfirmada={onJustificacionConfirmada}
                onClick={() => onSeleccionarDocente?.(docente)}
              />
            ))}
          </div>
        )}
      </Card.Content>
      {docentes.length > 0 && (
        <Card.Footer className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
          <Clock className="h-4 w-4" />
          <span>
            Tiempo estimado de espera:{' '}
            <strong>{docentes.filter(d => d.estado === 'ESPERANDO').length * 15} min</strong>
          </span>
        </Card.Footer>
      )}
    </Card>
  );
}
