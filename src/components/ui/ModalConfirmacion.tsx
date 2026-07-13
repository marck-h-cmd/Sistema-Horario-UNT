'use client';

import * as React from 'react';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from './Modal';
import { Boton } from './Boton';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

interface ModalConfirmacionProps {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: () => void;
  titulo: string;
  mensaje: string;
  tipo?: 'info' | 'warning' | 'success' | 'danger';
  textoConfirmar?: string;
  textoCancelar?: string;
  cargando?: boolean;
}

export function ModalConfirmacion({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  mensaje,
  tipo = 'warning',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  cargando = false,
}: ModalConfirmacionProps) {
  const iconos = {
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle,
    danger: XCircle,
  };

  const colores = {
    info: 'text-blue-600',
    warning: 'text-yellow-600',
    success: 'text-green-600',
    danger: 'text-red-600',
  };

  const Icono = iconos[tipo];

  return (
    <Modal open={abierto} onOpenChange={onCerrar}>
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-3">
            <Icono className={`h-6 w-6 ${colores[tipo]}`} />
            <ModalTitle>{titulo}</ModalTitle>
          </div>
          <ModalDescription>{mensaje}</ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Boton variant="secondary" onClick={onCerrar} disabled={cargando}>
            {textoCancelar}
          </Boton>
          <Boton
            variant={tipo === 'danger' ? 'danger' : tipo === 'success' ? 'success' : tipo === 'warning' ? 'warning' : 'info'}
            onClick={onConfirmar}
            disabled={cargando}
          >
            {cargando ? 'Procesando...' : textoConfirmar}
          </Boton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}