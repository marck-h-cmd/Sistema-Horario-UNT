'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IndicadorKPI } from '@/components/ui/IndicadorKPI';
import { TablaDatos, TablaHeader, TablaBody, TablaHead, TablaRow, TablaCell } from '@/components/ui/TablaDatos';
import {
  Clock,
  Users,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  Download,
} from 'lucide-react';
import { Boton } from '@/components/ui/Boton';

interface EstadisticasVentana {
  totalDocentes: number;
  docentesAtendidos: number;
  docentesPendientes: number;
  docentesAusentes: number;
  tiempoPromedioAtencion: number;
  tiempoTotalTranscurrido: number;
  tasaEficiencia: number;
}

interface DocenteAtendido {
  id: string;
  nombre: string;
  categoria: string;
  horaLlegada: string;
  horaAtencion: string;
  duracionMinutos: number;
  estado: 'atendido' | 'ausente' | 'pendiente';
}

interface ResumenVentanaProps {
  estadisticas: EstadisticasVentana;
  docentes: DocenteAtendido[];
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  onDescargarReporte?: () => void;
  className?: string;
}

export function ResumenVentana({
  estadisticas,
  docentes,
  fecha,
  horaInicio,
  horaFin,
  onDescargarReporte,
  className,
}: ResumenVentanaProps) {
  const formatearTiempo = (minutos: number) => {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className={className}>
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <div>
              <Card.Title className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Resumen de Ventana
              </Card.Title>
              <Card.Description>
                {fecha.toLocaleDateString('es-PE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                • {horaInicio} - {horaFin}
              </Card.Description>
            </div>
            {onDescargarReporte && (
              <Boton variant="teal" onClick={onDescargarReporte} className="gap-2">
                <Download className="h-4 w-4" />
                Descargar Reporte
              </Boton>
            )}
          </div>
        </Card.Header>
        <Card.Content className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicadorKPI
              titulo="Total Docentes"
              valor={estadisticas.totalDocentes}
              icono={Users}
            />
            <IndicadorKPI
              titulo="Atendidos"
              valor={estadisticas.docentesAtendidos}
              icono={CheckCircle}
              tendencia={{
                valor: Math.round(
                  (estadisticas.docentesAtendidos / estadisticas.totalDocentes) * 100
                ),
                tipo: 'positivo',
              }}
            />
            <IndicadorKPI
              titulo="Tiempo Promedio"
              valor={`${estadisticas.tiempoPromedioAtencion} min`}
              icono={Clock}
            />
            <IndicadorKPI
              titulo="Eficiencia"
              valor={`${Math.round(estadisticas.tasaEficiencia)}%`}
              icono={TrendingUp}
              tendencia={{
                valor: estadisticas.tasaEficiencia,
                tipo: estadisticas.tasaEficiencia >= 80 ? 'positivo' : 'negativo',
              }}
            />
          </div>

          {/* Estadísticas Adicionales */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-600">Tiempo Total</span>
              </div>
              <p className="text-2xl font-bold">
                {formatearTiempo(estadisticas.tiempoTotalTranscurrido)}
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">
                {estadisticas.docentesPendientes}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">Ausentes</span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {estadisticas.docentesAusentes}
              </p>
            </div>
          </div>

          {/* Tabla de Docentes Atendidos */}
          <div>
            <h3 className="font-semibold mb-3">Detalle de Atenciones</h3>
            <div className="rounded-md border">
              <TablaDatos>
                <TablaHeader>
                  <TablaRow>
                    <TablaHead>#</TablaHead>
                    <TablaHead>Docente</TablaHead>
                    <TablaHead>Categoría</TablaHead>
                    <TablaHead>Hora Llegada</TablaHead>
                    <TablaHead>Hora Atención</TablaHead>
                    <TablaHead>Duración</TablaHead>
                    <TablaHead>Estado</TablaHead>
                  </TablaRow>
                </TablaHeader>
                <TablaBody>
                  {docentes.length === 0 ? (
                    <TablaRow>
                      <TablaCell colSpan={7} className="h-24 text-center">
                        No hay registros de atención
                      </TablaCell>
                    </TablaRow>
                  ) : (
                    docentes.map((docente, index) => (
                      <TablaRow key={docente.id}>
                        <TablaCell className="font-medium">{index + 1}</TablaCell>
                        <TablaCell>{docente.nombre}</TablaCell>
                        <TablaCell>
                          <Badge variant="outline">{docente.categoria}</Badge>
                        </TablaCell>
                        <TablaCell>{docente.horaLlegada}</TablaCell>
                        <TablaCell>{docente.horaAtencion}</TablaCell>
                        <TablaCell>{docente.duracionMinutos} min</TablaCell>
                        <TablaCell>
                          <Badge
                            variant={
                              docente.estado === 'atendido'
                                ? 'success'
                                : docente.estado === 'ausente'
                                ? 'destructive'
                                : 'default'
                            }
                          >
                            {docente.estado}
                          </Badge>
                        </TablaCell>
                      </TablaRow>
                    ))
                  )}
                </TablaBody>
              </TablaDatos>
            </div>
          </div>

          {/* Análisis de Rendimiento */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">
              Análisis de Rendimiento
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">
                  <strong>Tasa de Atención:</strong>{' '}
                  {Math.round(
                    (estadisticas.docentesAtendidos / estadisticas.totalDocentes) * 100
                  )}%
                </p>
                <p className="text-blue-700 mt-1">
                  <strong>Tasa de Ausencia:</strong>{' '}
                  {Math.round(
                    (estadisticas.docentesAusentes / estadisticas.totalDocentes) * 100
                  )}%
                </p>
              </div>
              <div>
                <p className="text-blue-700">
                  <strong>Tiempo Total:</strong>{' '}
                  {formatearTiempo(estadisticas.tiempoTotalTranscurrido)}
                </p>
                <p className="text-blue-700 mt-1">
                  <strong>Tiempo por Docente:</strong>{' '}
                  {estadisticas.tiempoPromedioAtencion} min promedio
                </p>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}