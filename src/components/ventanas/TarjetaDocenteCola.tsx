'use client';

import * as React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Clock, AlertCircle, Eye, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utilidades';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/Modal';

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

interface TarjetaDocenteColaProps {
  docente: Docente;
  posicion: number;
  ventanaId: string;
  onJustificacionConfirmada?: (atencionId: string) => void;
  onClick?: () => void;
  className?: string;
}

const calcularAntiguedad = (fechaIngreso?: string | null): string => {
  if (!fechaIngreso) return '';
  const años = Math.floor(
    (new Date().getTime() - new Date(fechaIngreso).getTime())
    / (1000 * 60 * 60 * 24 * 365.25)
  );
  return `${años} año${años !== 1 ? 's' : ''} de servicio`;
};

export function TarjetaDocenteCola({
  docente,
  posicion,
  ventanaId,
  onJustificacionConfirmada,
  onClick,
  className,
}: TarjetaDocenteColaProps) {
  const iniciales = docente.nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [confirmando, setConfirmando] = React.useState(false);
  const [confirmado, setConfirmado] = React.useState(docente.justificacionConfirmada || false);
  const [errorConfirmacion, setErrorConfirmacion] = React.useState<string | null>(null);
  const isAusente = docente.estado === 'AUSENTE';
  const tieneJustificacion = docente.observaciones !== null && docente.observaciones !== undefined;

  const getBadgeEstado = () => {
    if (isAusente) {
      if (confirmado) {
        return { label: 'JUSTIFICACIÓN ACEPTADA', className: 'bg-green-500 text-white' };
      }
      if (tieneJustificacion) {
        return { label: 'AUSENTE JUSTIFICADO', className: 'bg-red-500 text-white' };
      }
      return { label: 'AUSENTE', className: 'bg-red-500 text-white' };
    }
    if (docente.estado === 'ESPERANDO') {
      return { label: 'EN ESPERA', className: 'bg-yellow-500 text-white' };
    }
    if (docente.estado === 'EN_ATENCION') {
      return { label: 'EN ATENCIÓN', className: 'bg-blue-500 text-white' };
    }
    if (docente.estado === 'ATENDIDO') {
      return { label: 'ATENDIDO', className: 'bg-green-500 text-white' };
    }
    return { label: docente.estado || 'DESCONOCIDO', className: 'bg-gray-500 text-white' };
  };

  const badgeEstado = getBadgeEstado();
  const antiguedad = calcularAntiguedad(docente.fechaIngreso);

  const handleConfirmarJustificacion = async () => {
    setConfirmando(true);
    setErrorConfirmacion(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `/api/ventanas-atencion/${ventanaId}/confirmar-justificacion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ atencionId: docente.atencionId }),
        }
      );

      if (res.ok) {
        setConfirmado(true);
        onJustificacionConfirmada?.(docente.atencionId);
        setTimeout(() => {
          setModalOpen(false);
        }, 1500);
      } else {
        const data = await res.json();
        setErrorConfirmacion(data.message || 'Error al confirmar');
      }
    } catch {
      setErrorConfirmacion('Error de conexión');
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <>
      <div
        onClick={onClick}
        className={cn(
          'flex flex-col gap-3 p-3 border dark:border-slate-700 rounded-lg transition-colors',
          isAusente ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer',
          docente.prioridad === 'urgente' && !isAusente && 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700',
          docente.prioridad === 'alta' && !isAusente && 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="relative">
              <Avatar fallback={iniciales} />
              <div className="absolute -top-1 -right-1 bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {posicion}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm truncate">{docente.nombre}</p>
              <Badge className={cn('text-xs', badgeEstado.className)}>
                {badgeEstado.label}
              </Badge>
              {docente.prioridad && docente.prioridad !== 'normal' && !isAusente && (
                <AlertCircle
                  className={cn(
                    'h-4 w-4',
                    docente.prioridad === 'urgente' && 'text-red-600',
                    docente.prioridad === 'alta' && 'text-yellow-600'
                  )}
                />
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400 truncate">{docente.email}</p>
            {antiguedad && (
              <p className="text-[10px] text-gray-400 dark:text-slate-500 italic mt-1">{antiguedad}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {docente.categoria}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                <Clock className="h-3 w-3" />
                {docente.horaLlegada}
              </div>
            </div>
          </div>
        </div>

        {isAusente && tieneJustificacion && !confirmado && (
          <div className="flex gap-2 mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-red-500 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver justificación
            </button>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Justificación de ausencia</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Docente</p>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{docente.nombre}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{docente.categoria}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tipo de ausencia</p>
                <Badge className="bg-amber-500 text-white text-xs">{docente.observaciones?.tipo ?? 'No especificado'}</Badge>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Motivo</p>
                <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                  <p className="text-sm text-gray-800 dark:text-slate-200">{docente.observaciones?.motivo ?? 'Sin motivo'}</p>
                </div>
              </div>
              {docente.observaciones?.documento && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Documento de respaldo</p>
                  <p className="text-sm text-gray-800 dark:text-slate-200">{docente.observaciones.documento}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fecha de envío</p>
                <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-slate-200">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {docente.observaciones?.fecha ? new Date(docente.observaciones.fecha).toLocaleString('es-PE') : 'No disponible'}
                </div>
              </div>
            </div>

            {errorConfirmacion && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {errorConfirmacion}
              </div>
            )}
          </div>
          <ModalFooter className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cerrar
            </button>

            {!confirmado ? (
              <button
                onClick={handleConfirmarJustificacion}
                disabled={confirmando}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                {confirmando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirmar justificación
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-5 py-2 bg-green-100 text-green-800 font-semibold rounded-lg text-sm">
                <CheckCircle className="h-4 w-4" />
                ✓ Justificación aceptada
              </div>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
