'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer, FileText, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol } from '@prisma/client';
import { toast } from 'sonner';

interface DocenteInfo {
  id: string;
  codigo: string;
  nombreCompleto: string;
  categoria: string;
  dedicacion: string;
  horasDedicacion: number;
  departamento?: {
    nombre: string;
    facultad?: {
      nombre: string;
    };
  };
}

interface Periodo {
  id: string;
  nombre: string;
}

export default function CargaHorariaPage() {
  const { user, loading: authLoading } = useRequireAuth([Rol.DOCENTE, Rol.ADMINISTRADOR, Rol.OPERADOR, Rol.SUPER_ADMIN]);
  const [loading, setLoading] = useState(true);
  const [docenteInfo, setDocenteInfo] = useState<DocenteInfo | null>(null);
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [selectedDocenteId, setSelectedDocenteId] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        if (user?.rol !== Rol.DOCENTE) {
          // Si es admin, cargar la lista de docentes para el combo
          const resPeriodos = await apiGet<any>('/api/periodos', { limit: 1 });
          const activo = resPeriodos.data?.find((p: any) => p.activo) || resPeriodos.data?.[0];
          if (activo) {
            const resDocentes = await apiGet<any[]>('/api/asignacion/docentes', { periodoId: activo.id });
            setDocentes(resDocentes.data || []);
            setPeriodo(activo);
          }
        } else {
          // Si es docente, cargar directamente su info
          const res = await apiGet<any>('/api/declaracion/lectiva');
          if (res.data) {
            setDocenteInfo(res.data.docente);
            setPeriodo(res.data.periodo);
          }
        }
      } catch (error) {
        toast.error('Error al cargar la información inicial');
      } finally {
        setLoading(false);
      }
    }
    if (user) loadData();
  }, [user]);

  // Cargar info de un docente seleccionado por el Admin
  useEffect(() => {
    if (user?.rol !== Rol.DOCENTE && selectedDocenteId && periodo) {
      async function loadSelectedDocente() {
        setLoading(true);
        try {
          const res = await apiGet<any>('/api/declaracion/lectiva', { 
            periodoId: periodo?.id, 
            docenteId: selectedDocenteId 
          });
          if (res.data) {
            setDocenteInfo(res.data.docente);
          }
        } catch (error) {
          toast.error('Error al cargar la información del docente');
        } finally {
          setLoading(false);
        }
      }
      loadSelectedDocente();
    } else if (user?.rol !== Rol.DOCENTE && !selectedDocenteId) {
      setDocenteInfo(null);
    }
  }, [selectedDocenteId, periodo, user]);

  const handleImprimir = (formato: string) => {
    // Simulación de la acción de imprimir/descargar, ya que los compañeros lo implementarán
    toast.success(`Generando PDF para ${formato}...`, {
      description: 'Esta funcionalidad será implementada por el equipo de backend.'
    });
  };

  if (authLoading || (loading && !docentes.length)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (user?.rol === Rol.DOCENTE && (!docenteInfo || !periodo)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        No se pudo cargar la información.
      </div>
    );
  }

  const formatos = [
    { num: 1, nombre: '(FORMATO # 1) Carga Horaria Asignada (Sede Central)', sede: 'Central', estado: 'Iniciado' },
    { num: 2, nombre: '(FORMATO # 2) Declaración Jurada (Sede Central)', sede: 'Central', estado: 'Iniciado' },
    { num: 3, nombre: '(FORMATO # 1) Carga Horaria Asignada (Sedes Desconcentradas)', sede: 'Sedes Desconcentradas', estado: 'Iniciado' },
    { num: 4, nombre: '(FORMATO # 2) Declaración Jurada (Sedes Desconcentradas)', sede: 'Sedes Desconcentradas', estado: 'Iniciado' },
    { num: 5, nombre: '(FORMATO # 3) Horario Semanal del Personal Docente', sede: 'Central', estado: 'Iniciado' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16 space-y-6">
      {/* Tabs visuales similares a la captura */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mt-2">
        <div className="px-6 py-2 border-b-2 border-transparent text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer">
          Horarios
        </div>
        <div className="px-6 py-2 border-b-2 border-transparent text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer">
          Notas
        </div>
        <div className="px-6 py-2 border-b-2 border-transparent text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer">
          Estadísticas
        </div>
      </div>
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-xs font-bold rounded-t-lg flex items-center gap-2 border border-b-0 border-amber-200 dark:border-amber-800/50">
          <FileText className="h-4 w-4" /> Carg. Hor.
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        
        {/* Cabecera */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase">
            CARGA HORARIA
          </h1>
          {user?.rol !== Rol.DOCENTE && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Docente:</label>
              <select
                value={selectedDocenteId}
                onChange={(e) => setSelectedDocenteId(e.target.value)}
                className="h-9 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm min-w-[250px]"
              >
                <option value="">Seleccione un docente...</option>
                {docentes.map(d => (
                  <option key={d.id} value={d.id}>{d.nombreCompleto}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Información del Docente */}
        {docenteInfo ? (
          <>
            <div className="p-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm">
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Semestre Académico:</span>
              <div className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-2">
                {periodo?.nombre || '-'}
                <span className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline flex items-center gap-1">
                  (Modificar Datos)
                </span>
              </div>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 md:col-span-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Docente:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium uppercase">{docenteInfo.nombreCompleto}</span>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 md:col-span-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">IBM completo:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{docenteInfo.codigo}</span>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 md:col-span-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Departamento Académico:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{docenteInfo.departamento?.nombre || '-'}</span>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 md:col-span-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Facultad:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{docenteInfo.departamento?.facultad?.nombre || 'Ingeniería'}</span>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 md:col-span-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Condición:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">Nombrado</span>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 md:col-span-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Categoría:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{Formateadores.categoriaDocente(docenteInfo.categoria)}</span>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 md:col-span-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Dedicación:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{Formateadores.dedicacionDocente(docenteInfo.dedicacion)} {docenteInfo.horasDedicacion} H</span>
            </div>
          </div>
        </div>

        {/* Tabla de Formatos */}
        <div className="p-4 sm:px-6">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-blue-600 dark:bg-blue-900 text-white font-bold text-xs uppercase">
                <tr>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center w-12">N°</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-left">Formato</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Sede</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Estado</th>
                  <th className="p-3 text-center w-32">Imprimir</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {formatos.map((f, i) => (
                  <tr key={f.num} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center font-medium">{f.num}</td>
                    <td className="p-3 border-r border-slate-200 dark:border-slate-700">{f.nombre}</td>
                    <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">{f.sede}</td>
                    <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> {f.estado}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImprimir(f.nombre)}
                        className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 h-8 gap-1.5"
                      >
                        <Printer className="h-4 w-4" />
                        <span className="text-xs">Imprimir</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        ) : (
          <div className="p-12 text-center text-slate-500">
            {user?.rol !== Rol.DOCENTE ? 'Seleccione un docente para visualizar sus formatos.' : 'No se pudo cargar la información del docente.'}
          </div>
        )}

        {/* Footer / Botón Volver */}
        <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 gap-2"
          >
            <span className="text-xl leading-none">&larr;</span> Volver
          </Button>
        </div>

      </div>
    </div>
  );
}
