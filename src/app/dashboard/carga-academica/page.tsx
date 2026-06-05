'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Search, Save, ArrowLeft, Info, Plus, Trash2, BookOpen } from 'lucide-react';
import PanelDistribucionHoraria from '@/components/horarios/PanelDistribucionHoraria';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, apiPost, apiRequest, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, TipoActividadNoLectiva, TipoComponente } from '@prisma/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const ACTIVIDADES_ORDENADAS = [
  { id: 'PREPARACION_Y_EVALUACION', num: 2, name: 'PREPARACIÓN Y EVALUACIÓN', desc: 'Exactamente el 50% (sin redondear) del Trabajo Lectivo', reqMeta: [] as string[], getMax: (lectivas: number) => Math.floor(lectivas * 0.5), isExact: true },
  { id: 'CONSEJERIA', num: 3, name: 'CONSEJERÍA Y TUTORÍA', desc: 'Señalar número de alumnos y el ciclo académico con los que se desarrolla. (Máx. 3 horas)', reqMeta: ['numAlumnos', 'ciclo'], getMax: () => 3 },
  { id: 'INVESTIGACION', num: 4, name: 'INVESTIGACIÓN', desc: 'Consignar el nro de inscripción, código, nombre y duración del proyecto. (Máx. 6 horas)', reqMeta: ['codigoProyecto'], getMax: () => 6 },
  { id: 'CAPACITACION', num: 5, name: 'CAPACITACIÓN', desc: 'Señale lo referente a este rubro en el marco de los planes de cada Facultad (Máx. 2 horas)', reqMeta: [] as string[], getMax: () => 2 },
  { id: 'ACTIVIDADES_DE_GOBIERNO', num: 6, name: 'ACTIVIDADES DE GOBIERNO', desc: 'Se desempeña cargo indique (Máx. 2 horas)', reqMeta: ['cargo'], getMax: () => 2 },
  { id: 'ACTIVIDADES_DE_ADMINISTRACION', num: 7, name: 'ACTIVIDADES DE ADMINISTRACIÓN', desc: 'Si desempeña cargo indique (Máx. 2 horas)', reqMeta: ['cargo'], getMax: () => 2 },
  { id: 'ASESORIA_DE_TESIS', num: 8, name: 'ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL', desc: 'Indicar el número de Resolución Decanal. (Máx. 2 horas)', reqMeta: ['resolucion'], getMax: () => 2 },
  { id: 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA', num: 9, name: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA', desc: 'Señalar actividad, proyecto o programa a ejecutarse. (Máx. 3 horas)', reqMeta: [] as string[], getMax: () => 3 },
  { id: 'COMITES_TECNICOS_Y_COMISIONES', num: 10, name: 'COMITÉS TÉCNICOS Y COMISIONES', desc: 'Consignar el número de Resolución autoritativa. (Máx. 2 horas)', reqMeta: ['resolucion'], getMax: () => 2 },
];

interface Periodo {
  id: string;
  nombre: string;
  activo: boolean;
}

interface Docente {
  id: string;
  codigo: string;
  nombreCompleto: string;
  categoria: string;
  departamento?: string;
  horasLectivasAsignadas: number;
}

interface CursoDisponible {
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
    asignaciones: any[];
  }[];
}

export default function CargaAcademicaAdminPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.OPERADOR]);

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('');
  
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [searchDocente, setSearchDocente] = useState('');
  const [selectedDocenteId, setSelectedDocenteId] = useState<string>('');
  
  const [dataLectiva, setDataLectiva] = useState<any | null>(null);
  const [loadingDocenteData, setLoadingDocenteData] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [formData, setFormData] = useState<Record<string, { horas: number; descripcion: string; metadata: any }>>({});
  
  // Estado para Modal de Asignar Curso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cursosDisponibles, setCursosDisponibles] = useState<CursoDisponible[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<string>('');
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [selectedComponentes, setSelectedComponentes] = useState<TipoComponente[]>([]);

  // 1. Cargar Períodos
  useEffect(() => {
    async function loadPeriodos() {
      try {
        const res = await apiGet<any>('/api/periodos', { limit: 100 });
        const list = Array.isArray(res.data) ? res.data : [];
        setPeriodos(list);
        const active = list.find((p: Periodo) => p.activo) || list[0];
        if (active) setSelectedPeriodoId(active.id);
      } catch (error) {
        toast.error('Error al cargar períodos');
      }
    }
    loadPeriodos();
  }, []);

  // 2. Cargar Docentes cuando cambie el período
  useEffect(() => {
    if (!selectedPeriodoId) return;
    async function loadDocentes() {
      try {
        const res = await apiGet<Docente[]>('/api/asignacion/docentes', { periodoId: selectedPeriodoId });
        setDocentes(res.data || []);
      } catch (error) {
        toast.error('Error al cargar docentes');
      }
    }
    loadDocentes();
  }, [selectedPeriodoId]);

  // 3. Cargar datos de Declaración cuando se selecciona un docente
  useEffect(() => {
    if (!selectedPeriodoId || !selectedDocenteId) {
      setDataLectiva(null);
      return;
    }
    
    async function loadData() {
      setLoadingDocenteData(true);
      try {
        // Inicializar form vacío
        const initial: any = {};
        ACTIVIDADES_ORDENADAS.forEach(act => {
          initial[act.id] = { horas: 0, descripcion: '', metadata: {} };
        });
        setFormData(initial);

        // Traer Lectiva
        const resL = await apiGet<any>('/api/declaracion/lectiva', { 
          periodoId: selectedPeriodoId, 
          docenteId: selectedDocenteId 
        });
        setDataLectiva(resL.data);

        // Traer No Lectiva
        const resNL = await apiGet<any>('/api/declaracion/no-lectiva', { 
          periodoId: selectedPeriodoId,
          docenteId: selectedDocenteId
        });
        if (resNL.data?.declaracion) {
          const dec = resNL.data.declaracion;
          setDataLectiva((prev: any) => prev ? { ...prev, declaracion: dec } : prev);
          setFormData(prev => {
            const next = { ...prev };
            dec.items.forEach((item: any) => {
              if (next[item.tipoActividad]) {
                next[item.tipoActividad] = {
                  horas: item.horasSemanales || 0,
                  descripcion: item.descripcion || '',
                  metadata: item.metadata || {}
                };
              }
            });
            return next;
          });
        }
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar la declaración del docente');
      } finally {
        setLoadingDocenteData(false);
      }
    }
    loadData();
  }, [selectedPeriodoId, selectedDocenteId]);

  // Manejo de Modal de Cursos
  const abrirModalAsignacion = async () => {
    setIsModalOpen(true);
    setSelectedCursoId('');
    setSelectedGrupoId('');
    setSelectedComponentes([]);
    try {
      const res = await apiGet<CursoDisponible[]>('/api/asignacion/cursos-disponibles', { periodoId: selectedPeriodoId });
      setCursosDisponibles(res.data || []);
    } catch (error) {
      toast.error('Error al cargar cursos disponibles');
    }
  };

  const asignarCurso = async () => {
    if (!selectedCursoId || !selectedGrupoId || selectedComponentes.length === 0) {
      toast.error('Complete todos los campos de asignación');
      return;
    }
    try {
      await apiPost('/api/asignacion/carga-lectiva', {
        periodoId: selectedPeriodoId,
        docenteId: selectedDocenteId,
        cursoId: selectedCursoId,
        grupoId: selectedGrupoId,
        componentes: selectedComponentes
      });
      toast.success('Curso asignado exitosamente');
      setIsModalOpen(false);
      // Recargar datos para ver la nueva asignación
      const resL = await apiGet<any>('/api/declaracion/lectiva', { 
        periodoId: selectedPeriodoId, 
        docenteId: selectedDocenteId 
      });
      setDataLectiva(resL.data);
    } catch (error: any) {
      toast.error(error instanceof ApiClientError ? error.message : 'Error al asignar curso');
    }
  };

  const eliminarAsignacion = async (horarioId: string) => {
    if (!confirm('¿Está seguro de eliminar esta asignación?')) return;
    try {
      await apiRequest(`/api/asignacion/carga-lectiva/${horarioId}`, { method: 'DELETE' });
      toast.success('Asignación eliminada');
      // Recargar
      const resL = await apiGet<any>('/api/declaracion/lectiva', { 
        periodoId: selectedPeriodoId, 
        docenteId: selectedDocenteId 
      });
      setDataLectiva(resL.data);
    } catch (error: any) {
      toast.error('Error al eliminar asignación');
    }
  };

  const handleFieldChange = (actId: string, field: string, value: any) => {
    if (field === 'horas') {
      const raw = typeof value === 'string' ? (value === '' ? 0 : Number(value)) : Number(value);
      const numValue = Number.isFinite(raw) ? Math.trunc(raw) : 0;
      const actDef = ACTIVIDADES_ORDENADAS.find(a => a.id === actId);
      if (actDef && actDef.getMax) {
        const max = actDef.getMax(dataLectiva?.totalHorasLectivas || 0);
        if (numValue > max) toast.error(`El máximo permitido para ${actDef.name} es ${max} horas.`);
      }
      setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], [field]: Math.max(0, numValue) } }));
      return;
    }
    setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], [field]: value } }));
  };

  const handleHorasBlur = (actId: string) => {
    const actDef = ACTIVIDADES_ORDENADAS.find(a => a.id === actId);
    if (!actDef || !actDef.getMax) return;
    const max = actDef.getMax(dataLectiva?.totalHorasLectivas || 0);
    setFormData(prev => {
      const current = prev[actId]?.horas ?? 0;
      const nextHoras = actDef.isExact ? max : Math.min(current, max);
      if (nextHoras !== current) {
        if (actDef.isExact) toast.error(`${actDef.name} debe ser exactamente ${max} horas.`);
        else toast.error(`El máximo permitido para ${actDef.name} es ${max} horas.`);
      }
      return { ...prev, [actId]: { ...prev[actId], horas: Math.max(0, nextHoras) } };
    });
  };

  const handleMetadataChange = (actId: string, metaField: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [actId]: { ...prev[actId], metadata: { ...prev[actId].metadata, [metaField]: value } }
    }));
  };

  const calcularTotalHoras = () => {
    return Object.values(formData).reduce((sum, item) => sum + (Number(item.horas) || 0), 0);
  };

  const handleGuardarNoLectiva = async () => {
    if (!dataLectiva) return;
    const itemsParaGuardar = Object.entries(formData)
      .filter(([_, data]) => data.horas > 0)
      .map(([id, data]) => ({
        tipoActividad: id as TipoActividadNoLectiva,
        horasSemanales: Number(data.horas),
        descripcion: data.descripcion,
        metadata: data.metadata
      }));

    setGuardando(true);
    try {
      await apiPost(`/api/declaracion/no-lectiva?docenteId=${selectedDocenteId}`, {
        periodoId: selectedPeriodoId,
        items: itemsParaGuardar,
        observaciones: 'Guardado por el Administrador.',
      });
      toast.success('Declaración guardada exitosamente.');
      const resNL = await apiGet<any>('/api/declaracion/no-lectiva', { periodoId: selectedPeriodoId, docenteId: selectedDocenteId });
      if (resNL.data?.declaracion) {
        setDataLectiva((prev: any) => prev ? { ...prev, declaracion: resNL.data.declaracion } : prev);
      }
      setTimeout(() => {
        document.getElementById('horario-personal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (error: any) {
      toast.error(error instanceof ApiClientError ? error.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const docentesFiltrados = useMemo(() => {
    return docentes.filter(d => 
      d.nombreCompleto.toLowerCase().includes(searchDocente.toLowerCase()) || 
      d.codigo.toLowerCase().includes(searchDocente.toLowerCase())
    );
  }, [docentes, searchDocente]);

  if (authLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

  const docenteInfo = dataLectiva?.docente;
  const asignaciones = dataLectiva?.asignaciones || [];
  const totalNoLectivas = calcularTotalHoras();

  const cursosAgrupados = asignaciones.reduce((acc: any, asig: any) => {
    const key = `${asig.cursoCodigo}-${asig.grupoNombre}`;
    if (!acc[key]) {
      acc[key] = {
        ids: [],
        codigo: asig.cursoCodigo,
        nombre: asig.cursoNombre,
        ciclo: asig.ciclo,
        seccion: asig.grupoNombre,
        teo: 0,
        pra: 0,
        lab: 0,
        alumnos: asig.alumnosAprox || 50
      };
    }
    acc[key].ids.push(asig.id);
    if (asig.tipoComponente === 'TEORIA') acc[key].teo += asig.horas;
    if (asig.tipoComponente === 'PRACTICA') acc[key].pra += asig.horas;
    if (asig.tipoComponente === 'LABORATORIO') acc[key].lab += asig.horas;
    return acc;
  }, {} as Record<string, any>);
  const lineasCursos = Object.values(cursosAgrupados);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Carga Académica" 
          description="Gestione y asigne la carga lectiva y no lectiva de los docentes."
        />
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Período:</label>
          <select
            value={selectedPeriodoId}
            onChange={(e) => setSelectedPeriodoId(e.target.value)}
            className="h-10 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
          >
            {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.activo ? '(Activo)' : ''}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden mt-6 gap-6">
        {/* Sidebar: Lista de Docentes */}
        <div className="w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" /> Docentes
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar docente..."
                value={searchDocente}
                onChange={e => setSearchDocente(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {docentesFiltrados.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDocenteId(d.id)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors ${
                  selectedDocenteId === d.id 
                    ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{d.nombreCompleto}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
                  <span>{d.codigo}</span>
                  <span className={d.horasLectivasAsignadas > 0 ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}>
                    {d.horasLectivasAsignadas}h asignadas
                  </span>
                </div>
              </button>
            ))}
            {docentesFiltrados.length === 0 && (
              <div className="text-center text-slate-500 text-sm p-4">No hay docentes.</div>
            )}
          </div>
        </div>

        {/* Contenido Principal: Declaración de Carga */}
        <div className="flex-1 overflow-y-auto pr-2 pb-16">
          {!selectedDocenteId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <BookOpen className="h-12 w-12 mb-4 opacity-50" />
              <p>Seleccione un docente para gestionar su carga horaria.</p>
            </div>
          ) : loadingDocenteData ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
          ) : dataLectiva ? (
            <div className="space-y-6">
              
              {/* Encabezado PDF-like */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-blue-600 dark:bg-blue-900 p-4 sm:px-6">
                  <h1 className="text-xl font-bold text-white uppercase tracking-wide">
                    CARGA HORARIA - DECLARACIÓN DE CARGA HORARIA ASIGNADA
                  </h1>
                  <p className="text-blue-100 text-sm mt-1">Período Académico {dataLectiva.periodo.nombre}</p>
                </div>
                
                <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase">I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm mb-6">
                    <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 w-40">FACULTAD:</span>
                      <span className="text-slate-800 dark:text-slate-100 font-medium">Ingeniería</span>
                    </div>
                    <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 w-40">DPTO. ACADÉMICO:</span>
                      <span className="text-slate-800 dark:text-slate-100 font-medium">{docenteInfo.departamento?.nombre || 'Dpto. de Ingeniería de Sistemas'}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-slate-200 dark:border-slate-700">
                      <thead className="bg-blue-50 dark:bg-slate-800 text-blue-900 dark:text-slate-200 font-bold text-xs uppercase">
                        <tr>
                          <th className="border border-slate-200 dark:border-slate-700 p-3 text-left">NOMBRE COMPLETO</th>
                          <th className="border border-slate-200 dark:border-slate-700 p-3 text-center">CONDICIÓN</th>
                          <th className="border border-slate-200 dark:border-slate-700 p-3 text-center">CATEGORÍA</th>
                          <th className="border border-slate-200 dark:border-slate-700 p-3 text-center">MODALIDAD</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-800 dark:text-slate-100">
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-3">{docenteInfo.nombreCompleto}</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-3 text-center">NOMBRADO</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-3 text-center">{Formateadores.categoriaDocente(docenteInfo.categoria)}</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-3 text-center">{Formateadores.dedicacionDocente(docenteInfo.dedicacion)} {docenteInfo.horasDedicacion} H</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 1. TRABAJO LECTIVO */}
                <div className="p-4 sm:px-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase">1. TRABAJO LECTIVO.- Datos completos y con claridad</h2>
                    <Button size="sm" onClick={abrirModalAsignacion} className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
                      <Plus className="h-4 w-4 mr-1" /> Asignar Curso
                    </Button>
                  </div>
                  
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-600 dark:bg-blue-900 text-white font-bold text-xs">
                        <tr>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">CÓDIGO</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-left">NOMBRE DEL CURSO</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">SECCIÓN</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">CURSO</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Escuela Prof.</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Ciclo</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Nro Tot. Alumnos</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">HrsTeo</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">HrsPra</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">HrsLab</th>
                          <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Total Hrs.</th>
                          <th className="p-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-700 dark:text-slate-200">
                        {lineasCursos.map((c: any, i: number) => {
                          const totalHrs = c.teo + c.pra + c.lab;
                          return (
                            <tr key={i} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-xs">{c.codigo}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-medium">{c.nombre}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">{c.seccion || '-'}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">OB</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">Ingeniería de Sistemas</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">{c.ciclo}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">Aprox. {c.alumnos}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-sky-50/50 dark:bg-sky-900/20">{c.teo}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-purple-50/50 dark:bg-purple-900/20">{c.pra}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-50/50 dark:bg-indigo-900/20">{c.lab}</td>
                              <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center font-bold text-blue-600 dark:text-blue-400">{totalHrs}</td>
                              <td className="p-2 text-center">
                                <button 
                                  onClick={() => {
                                    // Simplificación: eliminar el primer horario de este grupo (lo ideal es un dropdown de componentes)
                                    if (c.ids[0]) eliminarAsignacion(c.ids[0]);
                                  }}
                                  className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar asignación"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {lineasCursos.length === 0 && (
                          <tr>
                            <td colSpan={12} className="p-6 text-center text-slate-500">No tiene carga lectiva asignada.</td>
                          </tr>
                        )}
                        <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={10} className="p-3 text-right text-slate-700 dark:text-slate-300">TOTAL HORAS LECTIVAS:</td>
                          <td className="p-3 text-center text-blue-700 dark:text-blue-400">{dataLectiva.totalHorasLectivas}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECCIONES 2-10: ACTIVIDADES NO LECTIVAS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-8">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-400">
                    <p className="font-semibold mb-1">Información sobre la declaración No Lectiva:</p>
                    <ul className="list-disc list-inside ml-2 space-y-0.5 opacity-90">
                      <li>El docente debe declarar exactamente <strong>{dataLectiva.horasNoLectivasDisponibles} horas</strong> no lectivas.</li>
                      <li>Como administrador, usted puede visualizar o modificar esta información si es necesario.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  {ACTIVIDADES_ORDENADAS.map((act) => {
                    const data = formData[act.id];
                    if (!data) return null;
                    return (
                      <div key={act.id} className="border-b border-slate-100 dark:border-slate-800 pb-6 last:border-0 last:pb-0">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex-1 space-y-1">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase">{act.num}. {act.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{act.desc}</p>
                            {data.horas > 0 && act.reqMeta.length > 0 && (
                              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-150 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {act.reqMeta.includes('numAlumnos') && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">N° Alumnos</label>
                                    <input type="number" min={1} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm" value={data.metadata.numAlumnos || ''} onChange={(e) => handleMetadataChange(act.id, 'numAlumnos', parseInt(e.target.value) || 0)} />
                                  </div>
                                )}
                                {act.reqMeta.includes('ciclo') && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Ciclo</label>
                                    <input type="number" min={1} max={10} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm" value={data.metadata.ciclo || ''} onChange={(e) => handleMetadataChange(act.id, 'ciclo', parseInt(e.target.value) || 0)} />
                                  </div>
                                )}
                                {act.reqMeta.includes('codigoProyecto') && (
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Código del Proyecto</label>
                                    <input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm" value={data.metadata.codigoProyecto || ''} onChange={(e) => handleMetadataChange(act.id, 'codigoProyecto', e.target.value)} />
                                  </div>
                                )}
                                {act.reqMeta.includes('resolucion') && (
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">N° de Resolución</label>
                                    <input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm" value={data.metadata.resolucion || ''} onChange={(e) => handleMetadataChange(act.id, 'resolucion', e.target.value)} />
                                  </div>
                                )}
                                {act.reqMeta.includes('cargo') && (
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Cargo</label>
                                    <input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm" value={data.metadata.cargo || ''} onChange={(e) => handleMetadataChange(act.id, 'cargo', e.target.value)} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex gap-3 items-start justify-end">
                            {act.id !== 'PREPARACION_Y_EVALUACION' && (
                              <div className="flex-1 relative">
                                <textarea className="w-full min-h-[60px] resize-y bg-yellow-50/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Detalle de las actividades..." value={data.descripcion} onChange={(e) => handleFieldChange(act.id, 'descripcion', e.target.value)} />
                              </div>
                            )}
                            <div className="w-24 flex-shrink-0 flex items-center gap-2">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Horas:</label>
                              <input type="number" min="0" className="w-full h-10 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 text-center font-bold text-slate-800 dark:text-slate-100" value={data.horas} onChange={(e) => handleFieldChange(act.id, 'horas', e.target.value)} onBlur={() => handleHorasBlur(act.id)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer: Totales y Botones */}
                <div className="pt-6 border-t-2 border-slate-200 dark:border-slate-700 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Horas Lectivas</div>
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{dataLectiva.totalHorasLectivas} h</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Horas No Lectivas</div>
                        <div className="flex items-center gap-2">
                          <div className={`px-3 py-0.5 rounded border-2 font-bold text-lg ${
                            totalNoLectivas === dataLectiva.horasNoLectivasDisponibles 
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                              : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          }`}>
                            {totalNoLectivas}
                          </div>
                          <span className="text-xs font-semibold text-slate-500">
                            / {dataLectiva.horasNoLectivasDisponibles} h req.
                          </span>
                        </div>
                      </div>
                      <div className="pl-0 sm:pl-6 border-l-0 sm:border-l border-slate-200 dark:border-slate-700">
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total General</div>
                        <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{dataLectiva.totalHorasLectivas + totalNoLectivas} h / {docenteInfo.horasDedicacion} h</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-2">
                    <Button
                      onClick={handleGuardarNoLectiva}
                      disabled={guardando || totalNoLectivas !== dataLectiva.horasNoLectivasDisponibles}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                    >
                      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar Declaración
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* 3. HORARIO PERSONAL */}
              <div id="horario-personal">
                {dataLectiva?.declaracion && dataLectiva.declaracion.items.length > 0 && (
                  <PanelDistribucionHoraria
                    docenteId={docenteInfo.id}
                    periodoId={dataLectiva.periodo.id}
                    declaracionItems={dataLectiva.declaracion.items}
                    horariosLectivos={dataLectiva.asignaciones || []}
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal para Asignar Curso */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Asignar Curso a {docenteInfo?.nombreCompleto}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Curso</label>
              <select 
                value={selectedCursoId}
                onChange={(e) => { setSelectedCursoId(e.target.value); setSelectedGrupoId(''); }}
                className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Seleccione un curso...</option>
                {cursosDisponibles.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} - {c.nombre} (Ciclo {c.ciclo})</option>
                ))}
              </select>
            </div>
            
            {selectedCursoId && (
              <div>
                <label className="text-sm font-medium mb-1 block">Sección / Grupo</label>
                <select 
                  value={selectedGrupoId}
                  onChange={(e) => setSelectedGrupoId(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">Seleccione una sección...</option>
                  {cursosDisponibles.find(c => c.id === selectedCursoId)?.grupos.map(g => (
                    <option key={g.id} value={g.id}>Grupo {g.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedGrupoId && (
              <div>
                <label className="text-sm font-medium mb-2 block">Componentes a Asignar</label>
                <div className="flex gap-4">
                  {(['TEORIA', 'PRACTICA', 'LABORATORIO'] as TipoComponente[]).map(comp => {
                    const curso = cursosDisponibles.find(c => c.id === selectedCursoId);
                    const hasHoras = comp === 'TEORIA' ? curso?.horasTeoria : comp === 'PRACTICA' ? curso?.horasPractica : curso?.horasLaboratorio;
                    if (!hasHoras) return null;
                    
                    return (
                      <label key={comp} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedComponentes.includes(comp)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedComponentes([...selectedComponentes, comp]);
                            else setSelectedComponentes(selectedComponentes.filter(c => c !== comp));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span className="text-sm">{comp.charAt(0) + comp.slice(1).toLowerCase()}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={asignarCurso} className="bg-blue-600 text-white hover:bg-blue-700">Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
