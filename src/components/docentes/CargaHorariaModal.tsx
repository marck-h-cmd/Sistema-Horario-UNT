'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, downloadFile, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

interface CargaHorariaModalProps {
  docenteId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CargaHorariaModal({ docenteId, isOpen, onClose }: CargaHorariaModalProps) {
  const [loading, setLoading] = useState(false);
  const [docenteInfo, setDocenteInfo] = useState<DocenteInfo | null>(null);
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [loadingReporte, setLoadingReporte] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function loadData() {
      if (!docenteId || !isOpen) return;
      setLoading(true);
      try {
        const resPeriodos = await apiGet<any>('/api/periodos', { limit: 1 });
        const activo = resPeriodos.data?.find((p: any) => p.activo) || resPeriodos.data?.[0];
        
        if (activo) {
          setPeriodo(activo);
          const res = await apiGet<any>('/api/declaracion/lectiva', { 
            periodoId: activo.id, 
            docenteId 
          });
          if (res.data) {
            setDocenteInfo(res.data.docente);
          }
        }
      } catch (error) {
        toast.error('Error al cargar la información del docente');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [docenteId, isOpen]);

  const handleImprimir = async (num: number, nombre: string) => {
    if (!docenteInfo || !periodo) {
      toast.error('No se ha cargado la información del docente o del período.');
      return;
    }

    setLoadingReporte((prev) => ({ ...prev, [num]: true }));
    const loadingToastId = toast.loading(`Generando PDF para ${nombre}...`);

    try {
      const filename = `${nombre.replace(/[()#]/g, '').trim().replace(/\s+/g, '_')}.pdf`;

      let tipo: 'carga' | 'dj-central' | 'dj-desconcentrada' | 'horario' = 'carga';
      if (num === 2) tipo = 'dj-central';
      else if (num === 4) tipo = 'dj-desconcentrada';
      else if (num === 5) tipo = 'horario';

      const res = await apiPost<Blob>('/api/docente/generate-pdf', {
        tipo,
        docenteId: docenteInfo.id,
        periodoId: periodo.id,
      });

      if (res.success && res.data) {
        const blobUrl = window.URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        throw new Error('No se recibió el archivo PDF del servidor');
      }
      toast.success(`PDF de ${nombre} descargado con éxito`, { id: loadingToastId });
    } catch (error: any) {
      console.error('Error al imprimir/descargar PDF:', error);
      const msg = error instanceof ApiClientError ? error.message : error.message || 'Error al descargar';
      toast.error(msg, { id: loadingToastId });
    } finally {
      setLoadingReporte((prev) => ({ ...prev, [num]: false }));
    }
  };

  const formatos = [
    { num: 1, nombre: '(FORMATO # 1) Carga Horaria Asignada (Sede Central)', sede: 'Central', estado: 'Iniciado' },
    { num: 2, nombre: '(FORMATO # 2) Declaración Jurada (Sede Central)', sede: 'Central', estado: 'Iniciado' },
    { num: 3, nombre: '(FORMATO # 1) Carga Horaria Asignada (Sedes Desconcentradas)', sede: 'Sedes Desconcentradas', estado: 'Iniciado' },
    { num: 4, nombre: '(FORMATO # 2) Declaración Jurada (Sedes Desconcentradas)', sede: 'Sedes Desconcentradas', estado: 'Iniciado' },
    { num: 5, nombre: '(FORMATO # 3) Horario Semanal del Personal Docente', sede: 'Central', estado: 'Iniciado' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            CARGA HORARIA - {docenteInfo?.nombreCompleto || 'Cargando...'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-0">
          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : !docenteInfo ? (
            <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
              No se pudo cargar la información del docente.
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              {/* Tabs visuales */}
            
              <div className="flex border-b border-slate-200 dark:border-slate-800 px-4">
                <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-xs font-bold rounded-t-lg flex items-center gap-2 border border-b-0 border-amber-200 dark:border-amber-800/50">
                  <FileText className="h-4 w-4" /> Carg. Hor.
                </div>
              </div>

              {/* Información del Docente */}
              <div className="px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 w-48 shrink-0">Semestre Académico:</span>
                    <div className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-2">
                      {periodo?.nombre || '-'}
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
              <div className="px-4 sm:px-6">
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
                    <tbody className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900">
                      {formatos.map((f) => (
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
                              disabled={loadingReporte[f.num]}
                              onClick={() => handleImprimir(f.num, f.nombre)}
                              className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 h-8 gap-1.5"
                            >
                              {loadingReporte[f.num] ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              ) : (
                                <Printer className="h-4 w-4" />
                              )}
                              <span className="text-xs">
                                {loadingReporte[f.num] ? 'Generando...' : 'Imprimir'}
                              </span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
