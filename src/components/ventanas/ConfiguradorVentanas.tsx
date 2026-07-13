'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { SelectorFecha } from '@/components/ui/SelectorFecha';
import { SelectorHora } from '@/components/ui/SelectorHora';
import { Settings, Save } from 'lucide-react';
import { NotificacionToast } from '@/components/ui/NotificacionToast';

interface VentanaConfig {
  id?: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  capacidadMaxima: number;
  tiempoAtencionPromedio: number;
}

interface ConfiguradorVentanasProps {
  ventanaInicial?: VentanaConfig;
  onGuardar?: (ventana: VentanaConfig) => void;
  onCancelar?: () => void;
  className?: string;
}

export function ConfiguradorVentanas({
  ventanaInicial,
  onGuardar,
  onCancelar,
  className,
}: ConfiguradorVentanasProps) {
  const [ventana, setVentana] = React.useState<VentanaConfig>(
    ventanaInicial || {
      fecha: new Date(),
      horaInicio: '08:00',
      horaFin: '12:00',
      capacidadMaxima: 20,
      tiempoAtencionPromedio: 15,
    }
  );

  const handleGuardar = () => {
    if (!ventana.fecha || !ventana.horaInicio || !ventana.horaFin) {
      NotificacionToast.error('Completa todos los campos requeridos');
      return;
    }

    onGuardar?.(ventana);
    NotificacionToast.exito('Ventana configurada correctamente');
  };

  return (
    <Card className={className}>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configurar Ventana Horaria
        </Card.Title>
        <Card.Description>
          Define los parámetros de la ventana de atención
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <SelectorFecha
            fecha={ventana.fecha}
            onSeleccionarFecha={(fecha: Date) => setVentana({ ...ventana, fecha })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Hora Inicio
            </label>
            <SelectorHora
              valor={ventana.horaInicio}
              onCambio={(horaInicio: string) => setVentana({ ...ventana, horaInicio })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hora Fin</label>
            <SelectorHora
              valor={ventana.horaFin}
              onCambio={(horaFin: string) => setVentana({ ...ventana, horaFin })}
            />
          </div>
        </div>

        <CampoTexto
          label="Capacidad Máxima (docentes)"
          type="number"
          value={ventana.capacidadMaxima.toString()}
          onChange={(e) =>
            setVentana({
              ...ventana,
              capacidadMaxima: parseInt(e.target.value) || 0,
            })
          }
          min="1"
          max="100"
        />

        <CampoTexto
          label="Tiempo de Atención Promedio (minutos)"
          type="number"
          value={ventana.tiempoAtencionPromedio.toString()}
          onChange={(e) =>
            setVentana({
              ...ventana,
              tiempoAtencionPromedio: parseInt(e.target.value) || 0,
            })
          }
          min="5"
          max="60"
        />

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <p className="font-semibold text-blue-900 mb-1">
            Estimación de Capacidad
          </p>
          <p className="text-blue-700">
            Con estos parámetros, se podrán atender aproximadamente{' '}
            <strong>
              {Math.floor(
                ((parseInt(ventana.horaFin) - parseInt(ventana.horaInicio)) *
                  60) /
                  ventana.tiempoAtencionPromedio
              )}
            </strong>{' '}
            docentes en esta ventana.
          </p>
        </div>
      </Card.Content>
      <Card.Footer className="flex gap-2 justify-end">
        {onCancelar && (
          <Boton variant="secondary" onClick={onCancelar}>
            Cancelar
          </Boton>
        )}
        <Boton onClick={handleGuardar} className="gap-2">
          <Save className="h-4 w-4" />
          Guardar Configuración
        </Boton>
      </Card.Footer>
    </Card>
  );
}