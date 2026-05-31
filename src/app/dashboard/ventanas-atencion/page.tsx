'use client';

import { useEffect, useMemo, useState } from 'react';
import { 
  Loader2, 
  Plus, 
  Calendar, 
  Clock, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  History, 
  Send, 
  RefreshCw, 
  ChevronRight,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, apiPost, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePeriodo } from '@/contexts/PeriodoContext';
import { CategoriaDocente, Rol } from '@prisma/client';
import { toast } from 'sonner';
import { PantallaAtencion } from '@/components/ventanas/PantallaAtencion';

interface VentanaRow {
  id: string;
  nombre: string;
  categoria: string;
  fechaInicio: string;
  fechaFin: string;
  estado?: string;
}

export default function VentanasAtencionPage() {
  const { loading: authLoading } = useRequireAuth([
    Rol.SUPER_ADMIN,
    Rol.ADMINISTRADOR,
    Rol.OPERADOR,
  ]);
  const { periodoSeleccionado, loading: periodoLoading } = usePeriodo();
  const periodoId = periodoSeleccionado?.id ?? '';

  const [activeTab, setActiveTab] = useState<'config' | 'monitor'>('config');
  const [data, setData] = useState<VentanaRow[]>([]);
  const [reporte, setReporte] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modales
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [selectedHistorialWindow, setSelectedHistorialWindow] = useState<any>(null);
  const [justificacionOpen, setJustificacionOpen] = useState(false);
  const [selectedJustificacion, setSelectedJustificacion] = useState<any>(null);

  const [saving, setSaving] = useState(false);
  const [selectedVentanaId, setSelectedVentanaId] = useState<string | null>(null);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);

  // Formulario creación única
  const [form, setForm] = useState<{
    nombre: string;
    categoria: CategoriaDocente;
    fechaInicio: string;
    fechaFin: string;
  }>({
    nombre: '',
    categoria: CategoriaDocente.PRINCIPAL,
    fechaInicio: '',
    fechaFin: '',
  });

  // Formulario de Agregar Día
  const [addDayForm, setAddDayForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'NOMBRADOS' as 'NOMBRADOS' | 'CONTRATADOS',
  });

  // Fecha para reprogramación propuesta
  const [reprogramDate, setReprogramDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const load = async (silent = false) => {
    if (!periodoId) {
      setData([]);
      setReporte([]);
      return;
    }
    if (!silent) {
      setLoading(true);
      setLoadingReporte(true);
    }
    setError(null);
    try {
      const res = await apiGet<VentanaRow[]>('/api/ventanas-atencion', { periodoId });
      setData(res.data ?? []);

      const resRep = await fetch(`/api/ventanas-atencion/reporte-cola?periodoId=${periodoId}`);
      if (resRep.ok) {
        const dataRep = await resRep.json();
        setReporte(dataRep.data || []);
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Error al cargar ventanas');
      setData([]);
    } finally {
      if (!silent) {
        setLoading(false);
        setLoadingReporte(false);
      }
    }
  };

  useEffect(() => {
    load();

    const interval = setInterval(() => {
      load(true);
    }, 15000); // Polling cada 15 segundos

    return () => clearInterval(interval);
  }, [periodoId]);

  // Agrupar ventanas por día en Configuración
  const windowsByDay = useMemo(() => {
    const groups: Record<string, VentanaRow[]> = {};
    data.forEach((w) => {
      const dateStr = new Date(w.fechaInicio).toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(w);
    });

    return Object.keys(groups)
      .sort((a, b) => {
        const parseDate = (dStr: string) => {
          const [d, m, y] = dStr.split('/').map(Number);
          return new Date(y, m - 1, d).getTime();
        };
        return parseDate(a) - parseDate(b);
      })
      .map((dateStr, idx) => ({
        dayNumber: idx + 1,
        date: dateStr,
        windows: groups[dateStr].sort(
          (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
        ),
      }));
  }, [data]);

  // Agrupar reporte por día en Monitor
  const statsByDay = useMemo(() => {
    const groups: Record<string, any[]> = {};
    reporte.forEach((w) => {
      const dateStr = new Date(w.fechaInicio).toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(w);
    });

    return Object.keys(groups)
      .sort((a, b) => {
        const parseDate = (dStr: string) => {
          const [d, m, y] = dStr.split('/').map(Number);
          return new Date(y, m - 1, d).getTime();
        };
        return parseDate(a) - parseDate(b);
      })
      .map((dateStr) => ({
        date: dateStr,
        windows: groups[dateStr].sort(
          (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
        ),
      }));
  }, [reporte]);

  // Ventanas cerradas o pasadas con docentes pendientes
  const pendingReprograms = useMemo(() => {
    return reporte.filter(
      (w) =>
        w.pendientes > 0 &&
        (w.estado === 'CERRADA' || new Date(w.fechaFin).getTime() < new Date().getTime())
    );
  }, [reporte]);

  // Crear ventana individual
  const handleCreate = async () => {
    if (!periodoId) return;
    setSaving(true);
    try {
      await apiPost('/api/ventanas-atencion', {
        periodoId,
        nombre: form.nombre,
        categoria: form.categoria,
        fechaInicio: form.fechaInicio ? new Date(form.fechaInicio).toISOString() : '',
        fechaFin: form.fechaFin ? new Date(form.fechaFin).toISOString() : '',
      });
      toast.success('Ventana creada');
      setDialogOpen(false);
      setForm({
        nombre: '',
        categoria: CategoriaDocente.PRINCIPAL,
        fechaInicio: '',
        fechaFin: '',
      });
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  // Crear Lote (4 ventanas automáticas) para un día
  const handleGenerarDia = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ventanas-atencion/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodoId,
          date: addDayForm.date,
          type: addDayForm.type,
          timezoneOffset: new Date().getTimezoneOffset(),
        }),
      });
      const resJson = await res.json();
      if (res.ok) {
        toast.success(resJson.data.mensaje || 'Día creado exitosamente con 4 ventanas.');
        setAddDayOpen(false);
        load();
      } else {
        throw new Error(resJson.message || 'Error al generar día');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar una ventana
  const handleEliminarVentana = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta ventana de atención?')) return;
    try {
      const res = await fetch(`/api/ventanas-atencion/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Ventana de atención eliminada');
        load();
      } else {
        throw new Error('Error al eliminar ventana');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Reprogramar ventanas pendientes
  const handleReprogramarPendientes = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ventanas-atencion/reprogramar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodoId,
          date: reprogramDate,
        }),
      });
      const resJson = await res.json();
      if (res.ok) {
        toast.success(resJson.data.mensaje || 'Docentes pendientes reprogramados correctamente.');
        load();
      } else {
        throw new Error(resJson.message || 'Error al reprogramar');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Enviar notificaciones
  const handleEnviarNotificaciones = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ventanas-atencion/enviar-notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoId }),
      });
      const resJson = await res.json();
      if (res.ok) {
        toast.success(resJson.data.mensaje || 'Notificaciones de recordatorio enviadas.');
      } else {
        throw new Error(resJson.message || 'Error al enviar notificaciones');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Ver historial de docentes
  const handleVerHistorial = async (ventanaId: string) => {
    setHistorialLoading(true);
    setHistorialOpen(true);
    setSelectedHistorialWindow(null);
    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}`);
      if (res.ok) {
        const dataJson = await res.json();
        setSelectedHistorialWindow(dataJson.data);
      } else {
        throw new Error('No se pudieron obtener los detalles');
      }

      const resNotifs = await fetch('/api/notificaciones?tipo=SISTEMA&limit=50');
      if (resNotifs.ok) {
        const dataNotifs = await resNotifs.json();
        setNotificaciones(dataNotifs.data || []);
      }
    } catch (e: any) {
      toast.error(e.message);
      setHistorialOpen(false);
    } finally {
      setHistorialLoading(false);
    }
  };

  if (authLoading || periodoLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  if (selectedVentanaId) {
    return (
      <PantallaAtencion
        ventanaId={selectedVentanaId}
        onVolver={() => setSelectedVentanaId(null)}
      />
    );
  }

  if (!periodoId) {
    return (
      <div>
        <PageHeader title="Ventanas de atención" description="Turnos por categoría docente." />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Elija un período académico para listar o crear ventanas.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventanas de atención"
        description={`Período: ${periodoSeleccionado?.nombre}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAddDayOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Agregar Día
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-unt-blue hover:bg-unt-blue/90 text-white"
            >
              <Plus className="h-4 w-4" />
              Nueva ventana única
            </Button>
          </div>
        }
      />

      {error && <ErrorAlert message={error} className="mb-4" onRetry={load} />}

      {/* Selector de pestañas */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('config')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'config'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Configuración de Ventanas
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'monitor'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <History className="h-4 w-4" />
          Monitor de Ventanas
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : activeTab === 'config' ? (
        /* ==================== TAB 1: CONFIGURACIÓN ==================== */
        <div className="space-y-8">
          {windowsByDay.length === 0 ? (
            <div className="border border-dashed rounded-xl p-12 text-center text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800/30 dark:border-slate-700">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30 text-primary-600" />
              <p className="font-semibold text-sm">No hay ventanas de atención configuradas</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Haz clic en &quot;Agregar Día&quot; para generar las ventanas recomendadas.
              </p>
            </div>
          ) : (
            windowsByDay.map((day) => (
              <div key={day.date} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50/70 dark:bg-slate-800/50 border-b dark:border-slate-700 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                    <h3 className="font-bold text-gray-900 dark:text-slate-100">
                      Día {day.dayNumber}: {day.date}
                    </h3>
                    {day.windows.some((w) => w.nombre.includes('Continuación')) && (
                      <span className="bg-yellow-50 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded border border-yellow-200">
                        Continuación si no se terminó
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-700 dark:text-slate-300">
                    <thead className="text-xs text-gray-700 dark:text-slate-400 uppercase bg-gray-50/30 dark:bg-slate-800/50 border-b dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-3 w-16">Orden</th>
                        <th className="px-6 py-3">Categoría / Nombre</th>
                        <th className="px-6 py-3">Tipo de Categoria</th>
                        <th className="px-6 py-3">Desde</th>
                        <th className="px-6 py-3">Hasta</th>
                        <th className="px-6 py-3">Estado</th>
                        <th className="px-6 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {day.windows.map((w, index) => {
                        const start = new Date(w.fechaInicio).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const end = new Date(w.fechaFin).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={w.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                            <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-100">{index + 1}</td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-gray-900 dark:text-slate-100">{w.nombre}</span>
                            </td>
                            <td className="px-6 py-4">
                              {Formateadores.categoriaDocente(w.categoria)}
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-700 dark:text-slate-300">{start}</td>
                            <td className="px-6 py-4 font-semibold text-gray-700 dark:text-slate-300">{end}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  w.estado === 'ABIERTA' || w.estado === 'EN_CURSO'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                                    : w.estado === 'CERRADA'
                                    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {w.estado}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {w.estado === 'PROGRAMADA' && (
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/ventanas-atencion/${w.id}/estado`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ accion: 'abrir' }),
                                        });
                                        if (res.ok) {
                                          toast.success('Ventana de atención iniciada');
                                          setSelectedVentanaId(w.id);
                                        } else {
                                          const err = await res.json();
                                          throw new Error(err.message || 'Error al iniciar');
                                        }
                                      } catch (err: any) {
                                        toast.error(err.message);
                                      }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs py-1 px-3"
                                  >
                                    Iniciar
                                  </Button>
                                )}
                                {(w.estado === 'ABIERTA' || w.estado === 'EN_CURSO') && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => setSelectedVentanaId(w.id)}
                                      className="bg-unt-blue hover:bg-unt-blue/90 text-white font-semibold text-xs py-1 px-3"
                                    >
                                      Atender
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        if (!confirm('¿Está seguro de finalizar esta ventana de atención?')) return;
                                        try {
                                          const res = await fetch(`/api/ventanas-atencion/${w.id}/estado`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ accion: 'cerrar' }),
                                          });
                                          if (res.ok) {
                                            toast.success('Ventana de atención finalizada');
                                            load();
                                          } else {
                                            const err = await res.json();
                                            throw new Error(err.message || 'Error al finalizar');
                                          }
                                        } catch (err: any) {
                                          toast.error(err.message);
                                        }
                                      }}
                                      className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-1 px-3"
                                    >
                                      Finalizar
                                    </Button>
                                  </>
                                )}
                                {w.estado === 'PROGRAMADA' && (
                                  <button
                                    onClick={() => handleEliminarVentana(w.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ==================== TAB 2: MONITOR DE VENTANAS ==================== */
        <div className="space-y-8">
          {statsByDay.length === 0 ? (
            <div className="border border-dashed rounded-xl p-12 text-center text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800/30 dark:border-slate-700">
              <History className="h-12 w-12 mx-auto mb-2 opacity-30 text-primary-600" />
              <p className="font-semibold text-sm">No hay datos de monitoreo disponibles</p>
            </div>
          ) : (
            statsByDay.map((day) => (
              <div key={day.date} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50/70 dark:bg-slate-800/50 border-b dark:border-slate-700 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                    <h3 className="font-bold text-gray-900 dark:text-slate-100">{day.date}</h3>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-700 dark:text-slate-300">
                    <thead className="text-xs text-gray-700 dark:text-slate-400 uppercase bg-gray-50/30 dark:bg-slate-800/50 border-b dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-3">Categoría</th>
                        <th className="px-6 py-3">Estado</th>
                        <th className="px-6 py-3">Atendidos</th>
                        <th className="px-6 py-3">Pendientes</th>
                        <th className="px-6 py-3 text-right">Historial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {day.windows.map((w) => {
                        const completado = w.atendidos === w.total && w.total > 0;
                        const enProceso = w.estado === 'ABIERTA' || w.estado === 'EN_CURSO';

                        return (
                          <tr key={w.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                            <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-100">{w.nombre}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  completado
                                    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700'
                                    : enProceso
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700'
                                }`}
                              >
                                {completado ? '✅ Completado' : enProceso ? '🔄 En proceso' : '⏳ Pendiente'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-700 dark:text-slate-300">
                              {w.atendidos} / {w.total}
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-700 dark:text-slate-300">{w.pendientes}</td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerHistorial(w.id)}
                                className="flex items-center gap-1.5 ml-auto text-xs"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver Historial
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {/* Sección de Reprogramación/Avisos si hay pendientes */}
          {pendingReprograms.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 text-base">
                    Atención Incompleta Detectada
                  </h4>
                  <ul className="list-disc list-inside text-sm text-amber-800 space-y-1 mt-2">
                    {pendingReprograms.map((w) => (
                      <li key={w.id}>
                        <span className="font-semibold">{w.nombre}</span> NO se completó. Quedan{' '}
                        <span className="font-bold">{w.pendientes} docentes</span> en espera.
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-700 mt-2">
                    Se deben reprogramar estos docentes pendientes para la siguiente fecha disponible.
                  </p>
                </div>
              </div>

              <div className="border-t border-amber-200 pt-5 space-y-4">
                <h5 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Propuesta automática de reprogramación
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <Label className="text-xs font-bold text-amber-900">Fecha de reprogramación</Label>
                    <Input
                      type="date"
                      value={reprogramDate}
                      onChange={(e) => setReprogramDate(e.target.value)}
                      className="bg-white border-amber-200 focus:ring-amber-500 mt-1"
                    />
                  </div>
                </div>

                <div className="bg-white border border-amber-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left text-gray-700 dark:text-slate-300">
                    <thead className="text-xs text-gray-700 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-5 py-3">Categoría de Continuación</th>
                        <th className="px-5 py-3">Hora Producida</th>
                        <th className="px-5 py-3">Docentes Pendientes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {pendingReprograms.map((w) => {
                        const start = new Date(w.fechaInicio).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const end = new Date(w.fechaFin).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <tr key={w.id}>
                            <td className="px-5 py-3 font-semibold text-gray-900 dark:text-slate-100">
                              {w.nombre} (Continuación)
                            </td>
                            <td className="px-5 py-3 text-gray-600 dark:text-slate-400">
                              {start} - {end}
                            </td>
                            <td className="px-5 py-3 text-gray-700 dark:text-slate-300 font-semibold">
                              {w.pendientes} (continuación)
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleReprogramarPendientes}
                    disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Reprogramar Ventanas Pendientes
                  </Button>
                  <Button
                    onClick={handleEnviarNotificaciones}
                    variant="outline"
                    disabled={saving}
                    className="border-amber-300 text-amber-800 hover:bg-amber-100/50 font-semibold flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Send className="h-3.5 w-3.5" />
                    Enviar Notificaciones
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DIALOG: + Agregar Día */}
      <Dialog open={addDayOpen} onOpenChange={setAddDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generación de Día de Atención</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Fecha del Día de Atención</Label>
              <Input
                type="date"
                value={addDayForm.date}
                onChange={(e) => setAddDayForm({ ...addDayForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo de Día / Categorías a Generar</Label>
              <select
                value={addDayForm.type}
                onChange={(e) =>
                  setAddDayForm({
                    ...addDayForm,
                    type: e.target.value as 'NOMBRADOS' | 'CONTRATADOS',
                  })
                }
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="NOMBRADOS">Día Nombrados (Principal, Asociado, Auxiliar, JP)</option>
                <option value="CONTRATADOS">
                  Día Contratados (Principal, Asociado, Auxiliar, JP Contratado)
                </option>
              </select>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">Se crearán las siguientes 4 ventanas de atención automáticamente:</p>
              {addDayForm.type === 'NOMBRADOS' ? (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Principal Nombrado: 08:00am - 09:30am</li>
                  <li>Asociado Nombrado: 09:30am - 11:00am</li>
                  <li>Auxiliar Nombrado: 11:00am - 12:30pm</li>
                  <li>JP Nombrado: 12:30pm - 01:00pm</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Principal Contratado: 08:00am - 09:30am</li>
                  <li>Asociado Contratado: 09:30am - 11:00am</li>
                  <li>Auxiliar Contratado: 11:00am - 12:30pm</li>
                  <li>JP Contratado: 12:30pm - 01:00pm</li>
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDayOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerarDia}
              disabled={saving || !addDayForm.date}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generar Día'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Nueva ventana única */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva ventana de atención</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <Label>Categoría atendida</Label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.categoria}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoria: e.target.value as CategoriaDocente }))
                }
              >
                {Object.values(CategoriaDocente).map((c) => (
                  <option key={c} value={c}>
                    {Formateadores.categoriaDocente(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Inicio</Label>
              <Input
                type="datetime-local"
                value={form.fechaInicio}
                onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
              />
            </div>
            <div>
              <Label>Fin</Label>
              <Input
                type="datetime-local"
                value={form.fechaFin}
                onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !form.nombre.trim()}
              onClick={handleCreate}
              className="bg-unt-blue hover:bg-unt-blue/90 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Ver Historial de Docentes */}
      <Dialog open={historialOpen} onOpenChange={setHistorialOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Docentes - {selectedHistorialWindow?.nombre}</DialogTitle>
          </DialogHeader>

          {historialLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : !selectedHistorialWindow ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 py-4">No se pudo cargar el historial.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Programación original</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {new Date(selectedHistorialWindow.fechaInicio).toLocaleString('es-PE')} -{' '}
                  {new Date(selectedHistorialWindow.fechaFin).toLocaleString('es-PE')}
                </p>
              </div>

              <div className="border dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left text-gray-700 dark:text-slate-300">
                  <thead className="text-xs text-gray-700 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 w-16">Pos</th>
                      <th className="px-4 py-2.5">Código / Nombre</th>
                      <th className="px-4 py-2.5">Estado</th>
                      <th className="px-4 py-2.5">Inicio / Fin</th>
                      <th className="px-4 py-2.5">Justificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {selectedHistorialWindow.atenciones.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500 dark:text-slate-400">
                          Ningún docente registrado en cola para esta ventana.
                        </td>
                      </tr>
                    ) : (
                      selectedHistorialWindow.atenciones.map((a: any) => {
                        const justificacion = notificaciones.find((n: any) => 
                          n.metadata?.atencionId === a.id && n.metadata?.ventanaId === selectedHistorialWindow.id
                        );
                        return (
                          <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                            <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-slate-100">{a.posicion}</td>
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-gray-900 dark:text-slate-100">
                                {a.docente.usuario.nombre} {a.docente.usuario.apellidos}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-slate-400">{a.docente.codigo}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                  a.estado === 'ATENDIDO'
                                    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700'
                                    : a.estado === 'EN_ATENCION'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                                    : a.estado === 'AUSENTE'
                                    ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {a.estado}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400">
                              {a.horaInicio
                                ? new Date(a.horaInicio).toLocaleTimeString('es-PE', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}{' '}
                              /{' '}
                              {a.horaFin
                                ? new Date(a.horaFin).toLocaleTimeString('es-PE', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col gap-1 items-start">
                                {a.estado === 'AUSENTE' && justificacion && (
                                  <button
                                    onClick={() => {
                                      setSelectedJustificacion(justificacion);
                                      setJustificacionOpen(true);
                                    }}
                                    className="text-xs text-red-600 underline hover:text-red-800 text-left"
                                  >
                                    Ver justificación
                                  </button>
                                )}
                                {a.estado === 'AUSENTE' && (
                                  <button
                                    onClick={async () => {
                                      if (confirm('¿Está seguro de reprogramar el turno de este docente? Se colocará al final de la cola activa de espera.')) {
                                        try {
                                          const res = await fetch(`/api/ventanas-atencion/${selectedHistorialWindow.id}/reprogramar`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ docenteId: a.docenteId }),
                                          });
                                          if (res.ok) {
                                            toast.success('Docente reprogramado exitosamente');
                                            // Refrescar el historial
                                            handleVerHistorial(selectedHistorialWindow.id);
                                          } else {
                                            const err = await res.json();
                                            throw new Error(err.message || 'Error al reprogramar');
                                          }
                                        } catch (err: any) {
                                          toast.error(err.message);
                                        }
                                      }
                                    }}
                                    className="text-xs text-unt-blue hover:underline text-left font-semibold mt-1"
                                  >
                                    Reprogramar turno
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setHistorialOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Ver Justificación */}
      <Dialog open={justificacionOpen} onOpenChange={setJustificacionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Justificación de ausencia</DialogTitle>
          </DialogHeader>
          {selectedJustificacion && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Docente</p>
                <p className="text-sm font-medium text-gray-900">{selectedJustificacion.metadata.docenteNombre}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tipo de ausencia</p>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {selectedJustificacion.metadata.tipo}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Motivo</p>
                <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-800">{selectedJustificacion.metadata.motivo}</p>
                </div>
              </div>
              {selectedJustificacion.metadata.documento && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Documento de respaldo</p>
                  <p className="text-sm text-gray-800">{selectedJustificacion.metadata.documento}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha de envío</p>
                <p className="text-sm text-gray-800">
                  {new Date(selectedJustificacion.metadata.fecha).toLocaleString('es-PE')}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setJustificacionOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
