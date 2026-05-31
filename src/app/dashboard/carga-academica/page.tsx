'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Search, Trash2, GraduationCap, Clock, BookOpen, Layers, CheckCircle2, AlertTriangle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { apiGet, apiPost, apiRequest, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, TipoComponente } from '@prisma/client';
import { toast } from 'sonner';

interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  ciclo: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  grupos: {
    id: string;
    nombre: string;
    capacidad: number;
    asignaciones: {
      horarioId: string;
      docenteId: string;
      docenteNombre: string;
      componente: TipoComponente;
      horas: number;
      diaSemana: string | null;
      horaInicio: string | null;
      horaFin: string | null;
      ambienteId: string | null;
      estado: string;
    }[];
  }[];
}

interface Docente {
  id: string;
  codigo: string;
  nombreCompleto: string;
  email: string;
  categoria: string;
  dedicacion: string;
  horasDedicacion: number;
  horasLectivasAsignadas: number;
  departamento: string | null;
}

interface Periodo {
  id: string;
  nombre: string;
  activo: boolean;
  estado: string;
}

export default function CargaAcademicaPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.OPERADOR]);
  const { confirm, state: confirmState, handleClose: handleConfirmClose } = useConfirm();

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('');
  
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [loadingDocentes, setLoadingDocentes] = useState(false);
  
  const [cursoSearch, setCursoSearch] = useState('');
  const [docenteSearch, setDocenteSearch] = useState('');
  const [selectedCiclo, setSelectedCiclo] = useState<string>('TODOS');
  
  const [expandedCursos, setExpandedCursos] = useState<Record<string, boolean>>({});
  const [activeDragDocenteId, setActiveDragDocenteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 1. Cargar Períodos
  useEffect(() => {
    async function loadPeriodos() {
      try {
        const res = await apiGet<any>('/api/periodos', { limit: 100 });
        const list = Array.isArray(res.data) ? res.data : [];
        setPeriodos(list);
        
        // Seleccionar el período activo por defecto, o el primero
        const active = list.find((p: Periodo) => p.activo);
        if (active) {
          setSelectedPeriodoId(active.id);
        } else if (list[0]) {
          setSelectedPeriodoId(list[0].id);
        }
      } catch (error) {
        console.error('Error cargando períodos:', error);
        toast.error('No se pudieron cargar los períodos académicos');
      }
    }
    loadPeriodos();
  }, []);

  // 2. Cargar Cursos y Docentes
  const loadData = async (periodoId: string) => {
    if (!periodoId) return;
    
    setLoadingCursos(true);
    setLoadingDocentes(true);
    
    try {
      const [resCursos, resDocentes] = await Promise.all([
        apiGet<Curso[]>('/api/asignacion/cursos-disponibles', { periodoId }),
        apiGet<Docente[]>('/api/asignacion/docentes', { periodoId }),
      ]);
      
      setCursos(Array.isArray(resCursos.data) ? resCursos.data : []);
      setDocentes(Array.isArray(resDocentes.data) ? resDocentes.data : []);
      
      // Auto expandir los primeros 3 cursos para mejorar visualización inicial
      if (Array.isArray(resCursos.data) && resCursos.data.length > 0) {
        const initialExpanded: Record<string, boolean> = {};
        resCursos.data.slice(0, 3).forEach((c) => {
          initialExpanded[c.id] = true;
        });
        setExpandedCursos(initialExpanded);
      }
    } catch (error) {
      console.error('Error cargando datos de asignación:', error);
      toast.error('Error al actualizar listados del período');
    } finally {
      setLoadingCursos(false);
      setLoadingDocentes(false);
    }
  };

  useEffect(() => {
    if (selectedPeriodoId) {
      loadData(selectedPeriodoId);
    }
  }, [selectedPeriodoId]);

  // Manejo de expandir/colapsar curso
  const toggleCursoExpand = (cursoId: string) => {
    setExpandedCursos((prev) => ({
      ...prev,
      [cursoId]: !prev[cursoId],
    }));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, docenteId: string) => {
    e.dataTransfer.setData('text/plain', docenteId);
    setActiveDragDocenteId(docenteId);
  };

  const handleDragEnd = () => {
    setActiveDragDocenteId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (
    e: React.DragEvent,
    cursoId: string,
    grupoId: string,
    componente: TipoComponente
  ) => {
    e.preventDefault();
    const docenteId = e.dataTransfer.getData('text/plain');
    if (!docenteId || !selectedPeriodoId) return;

    await realizarAsignacion(docenteId, cursoId, grupoId, componente);
  };

  const realizarAsignacion = async (
    docenteId: string,
    cursoId: string,
    grupoId: string,
    componente: TipoComponente
  ) => {
    const loadingToastId = toast.loading('Asignando carga lectiva...');
    try {
      const res = (await apiPost('/api/asignacion/carga-lectiva', {
        periodoId: selectedPeriodoId,
        docenteId,
        cursoId,
        grupoId,
        componentes: [componente],
      })) as any;
      
      toast.success('Docente asignado exitosamente', { id: loadingToastId });
      
      // Mostrar advertencias del servicio si las hubiera
      if (res.data?.advertencias && res.data.advertencias.length > 0) {
        res.data.advertencias.forEach((adv: string) => {
          toast.warning(adv, { duration: 6000 });
        });
      }
      
      // Recargar datos
      loadData(selectedPeriodoId);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof ApiClientError ? error.message : 'Error al realizar asignación';
      toast.error(msg, { id: loadingToastId, duration: 6000 });
    }
  };

  const handleRemove = async (horarioId: string, docenteNombre: string, cursoCodigo: string) => {
    const ok = await confirm({
      title: 'Quitar asignación',
      message: `¿Remover al docente ${docenteNombre} del curso ${cursoCodigo}?`,
      variant: 'destructive',
      confirmLabel: 'Quitar',
    });
    
    if (!ok) return;
    
    const loadingToastId = toast.loading('Eliminando asignación...');
    try {
      await apiRequest(`/api/asignacion/carga-lectiva/${horarioId}`, {
        method: 'DELETE',
      });
      toast.success('Asignación eliminada exitosamente', { id: loadingToastId });
      loadData(selectedPeriodoId);
    } catch (error: any) {
      const msg = error instanceof ApiClientError ? error.message : 'Error al remover asignación';
      toast.error(msg, { id: loadingToastId });
    }
  };

  // Filtrado de Cursos
  const filteredCursos = cursos.filter((c) => {
    const matchesSearch =
      c.nombre.toLowerCase().includes(cursoSearch.toLowerCase()) ||
      c.codigo.toLowerCase().includes(cursoSearch.toLowerCase());
    
    const matchesCiclo = selectedCiclo === 'TODOS' || c.ciclo.toString() === selectedCiclo;
    
    return matchesSearch && matchesCiclo;
  });

  // Filtrado de Docentes
  const filteredDocentes = docentes.filter((d) => {
    const matchesSearch =
      d.nombreCompleto.toLowerCase().includes(docenteSearch.toLowerCase()) ||
      d.codigo.toLowerCase().includes(docenteSearch.toLowerCase()) ||
      (d.departamento && d.departamento.toLowerCase().includes(docenteSearch.toLowerCase()));
    
    return matchesSearch;
  });

  // Helper para obtener color de la barra de horas asignadas
  const getProgressBarColor = (actual: number, limite: number) => {
    const pct = (actual / limite) * 100;
    if (pct > 100) return 'bg-red-500';
    if (pct === 100) return 'bg-emerald-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-12">
      <PageHeader
        title="Asignación de Carga Lectiva"
        description="Gestione y asigne las horas lectivas (Teoría, Práctica y Laboratorio) del departamento académico."
        actions={
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <Layers className="h-4 w-4 text-slate-400" />
            <select
              className="bg-transparent text-sm font-medium focus:outline-none dark:text-slate-100 cursor-pointer"
              value={selectedPeriodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-slate-800">
                  Período {p.nombre} {p.activo ? '(Activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Workspace de dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: CURSOS Y GRUPOS (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Catálogo de Cursos
            </h2>
            
            {/* Buscador e Indicadores */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar curso por nombre o código..."
                  value={cursoSearch}
                  onChange={(e) => setCursoSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl border-0 py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Ciclo:</span>
                <select
                  value={selectedCiclo}
                  onChange={(e) => setSelectedCiclo(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 text-sm font-medium py-2 px-3 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 dark:text-slate-100 cursor-pointer"
                >
                  <option value="TODOS">Todos</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                    <option key={c} value={c.toString()}>{c}° Ciclo</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingCursos ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-sm text-slate-400">Cargando cursos y grupos...</span>
              </div>
            ) : filteredCursos.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <AlertTriangle className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <span className="text-sm text-slate-500">No se encontraron cursos con los filtros aplicados.</span>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                {filteredCursos.map((curso) => {
                  const isExpanded = !!expandedCursos[curso.id];
                  return (
                    <div
                      key={curso.id}
                      className="group border border-slate-100 dark:border-slate-800 rounded-xl hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200 bg-slate-50/50 dark:bg-slate-900/50 shadow-sm"
                    >
                      {/* Cabecera del Curso (Clickable para expandir) */}
                      <div
                        onClick={() => toggleCursoExpand(curso.id)}
                        className="p-4 flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded">
                              {curso.codigo}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                              {curso.ciclo}° Ciclo
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-500 transition-colors">
                            {curso.nombre}
                          </h3>
                        </div>
                        <div className="flex items-center gap-6">
                          {/* Horas del plan */}
                          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span title="Horas de Teoría">T: {curso.horasTeoria}h</span>
                            <span title="Horas de Práctica">P: {curso.horasPractica}h</span>
                            {curso.horasLaboratorio > 0 && <span title="Horas de Laboratorio">L: {curso.horasLaboratorio}h</span>}
                          </div>
                          
                          {/* Flecha indicadora */}
                          <svg
                            className={`h-5 w-5 text-slate-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Grupos y Asignaciones Expandidos */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-b-xl p-4 space-y-4">
                          {curso.grupos.map((grupo) => (
                            <div key={grupo.id} className="border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 space-y-3 bg-slate-50/20 dark:bg-slate-900/10">
                              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                                  Grupo {grupo.nombre}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Capacidad: {grupo.capacidad} estudiantes
                                </span>
                              </div>

                              {/* Componentes a asignar */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Componente Teoría */}
                                {curso.horasTeoria > 0 && renderComponentSlot(
                                  curso,
                                  grupo,
                                  TipoComponente.TEORIA,
                                  curso.horasTeoria
                                )}

                                {/* Componente Práctica */}
                                {curso.horasPractica > 0 && renderComponentSlot(
                                  curso,
                                  grupo,
                                  TipoComponente.PRACTICA,
                                  curso.horasPractica
                                )}

                                {/* Componente Laboratorio */}
                                {curso.horasLaboratorio > 0 && renderComponentSlot(
                                  curso,
                                  grupo,
                                  TipoComponente.LABORATORIO,
                                  curso.horasLaboratorio
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: DOCENTES (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-500" />
                Docentes Disponibles
              </h2>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md font-semibold">
                {filteredDocentes.length} total
              </span>
            </div>

            {/* Instrucción drag and drop */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 p-3 rounded-xl flex items-start gap-2.5">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">💡</span>
              <p className="text-xs text-blue-700/90 dark:text-blue-300 leading-relaxed">
                <strong>Instrucciones:</strong> Arrastre un docente desde esta lista y suéltelo sobre los recuadros de componentes del curso (Teoría, Práctica, Laboratorio) para asignarlo.
              </p>
            </div>

            {/* Buscador de Docentes */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar docente por nombre o código..."
                value={docenteSearch}
                onChange={(e) => setDocenteSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl border-0 py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
            </div>

            {loadingDocentes ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-sm text-slate-400">Cargando docentes...</span>
              </div>
            ) : filteredDocentes.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <User className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <span className="text-sm text-slate-500">No se encontraron docentes.</span>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                {filteredDocentes.map((docente) => {
                  const percent = Math.min(
                    100,
                    (docente.horasLectivasAsignadas / docente.horasDedicacion) * 100
                  );
                  const isDragActive = activeDragDocenteId === docente.id;

                  return (
                    <div
                      key={docente.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, docente.id)}
                      onDragEnd={handleDragEnd}
                      className={`p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all cursor-grab active:cursor-grabbing relative overflow-hidden select-none group ${isDragActive ? 'opacity-40 border-blue-500 bg-blue-50/10' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-500 transition-colors">
                            {docente.nombreCompleto}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span>Código: {docente.codigo}</span>
                            <span>•</span>
                            <span className="font-medium">{Formateadores.categoriaDocente(docente.categoria)}</span>
                          </div>
                          {docente.departamento && (
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                              DEPT. {docente.departamento}
                            </p>
                          )}
                        </div>

                        {/* Indicador de dedicación */}
                        <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {docente.dedicacion === 'TIEMPO_COMPLETO_40H' || docente.dedicacion === 'DEDICACION_EXCLUSIVA' ? '40h' : '20h'}
                        </span>
                      </div>

                      {/* Barra de progreso de horas asignadas */}
                      <div className="mt-4 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Lectivas asignadas:
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {docente.horasLectivasAsignadas} / {docente.horasDedicacion} h
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(docente.horasLectivasAsignadas, docente.horasDedicacion)}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onConfirm={() => handleConfirmClose(true)}
        onCancel={() => handleConfirmClose(false)}
      />
    </div>
  );

  // Renderizador para las celdas de componentes a asignar (Teoría, Práctica, Laboratorio)
  function renderComponentSlot(
    curso: Curso,
    grupo: any,
    componente: TipoComponente,
    horas: number
  ) {
    // Buscar si ya tiene docente asignado
    const asignacion = grupo.asignaciones.find(
      (a: any) => a.componente === componente
    );

    const label = componente === TipoComponente.TEORIA ? 'Teoría' : componente === TipoComponente.PRACTICA ? 'Práctica' : 'Laboratorio';
    const bgCol = componente === TipoComponente.TEORIA ? 'border-sky-200 bg-sky-50/10 text-sky-700 dark:text-sky-400 dark:border-sky-950' : componente === TipoComponente.PRACTICA ? 'border-purple-200 bg-purple-50/10 text-purple-700 dark:text-purple-400 dark:border-purple-950' : 'border-indigo-200 bg-indigo-50/10 text-indigo-700 dark:text-indigo-400 dark:border-indigo-950';
    
    if (asignacion) {
      return (
        <div className={`p-2.5 rounded-lg border flex flex-col justify-between h-24 ${bgCol}`}>
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {label} ({horas}h)
            </span>
            <button
              onClick={() => handleRemove(asignacion.horarioId, asignacion.docenteNombre, curso.codigo)}
              className="text-slate-400 hover:text-red-500 transition-colors p-0.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded"
              title="Quitar asignación"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold line-clamp-1 text-slate-800 dark:text-slate-200">
              {asignacion.docenteNombre}
            </p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
              {asignacion.estado}
            </p>
          </div>
        </div>
      );
    }

    // Dropzone vacío
    return (
      <div
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, curso.id, grupo.id, componente)}
        className="p-2.5 rounded-lg border border-dashed border-slate-250 dark:border-slate-800 bg-slate-50/30 hover:border-blue-500 hover:bg-blue-50/10 dark:hover:bg-blue-950/10 hover:text-blue-600 dark:hover:text-blue-400 flex flex-col items-center justify-center text-center text-slate-400 cursor-default transition-all duration-200 h-24 group/drop"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-slate-400 group-hover/drop:text-blue-500">
          {label} ({horas}h)
        </span>
        <span className="text-[10px] leading-tight px-2 group-hover/drop:scale-105 transition-transform">
          Arrastre docente aquí
        </span>
      </div>
    );
  }
}
