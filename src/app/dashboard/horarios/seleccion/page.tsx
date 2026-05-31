'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, DiaSemana, TipoAmbiente } from '@prisma/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { apiGet, apiPost, ApiClientError } from '@/lib/api-client';
import { 
  Loader2, ArrowLeft, BookOpen, Clock, Users, Save, 
  CheckCircle2, AlertCircle, FlaskConical, CalendarDays,
  ChevronRight, Info
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Boton } from '@/components/ui/Boton';
import { Card } from '@/components/ui/Card';
import { 
  Selector, 
  SelectorTrigger, 
  SelectorValue, 
  SelectorContent, 
  SelectorItem 
} from '@/components/ui/Selector';
import { cn } from '@/lib/cn';

interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  ciclo: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  grupos: { id: string; nombre: string }[];
  horarios?: any[];
}

interface Ambiente {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoAmbiente;
  capacidad: number;
}

interface Periodo {
  id: string;
  nombre: string;
}

const DIAS_OPCIONES = [
  { value: DiaSemana.LUNES, label: 'LUN' },
  { value: DiaSemana.MARTES, label: 'MAR' },
  { value: DiaSemana.MIERCOLES, label: 'MIÉ' },
  { value: DiaSemana.JUEVES, label: 'JUE' },
  { value: DiaSemana.VIERNES, label: 'VIE' },
];

const HORAS_OPCIONES = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7;
  return { value: `${h.toString().padStart(2, '0')}:00`, label: `${h.toString().padStart(2, '0')}:00` };
});

export default function SeleccionHorarioPage() {
  const { user, loading: authLoading } = useRequireAuth([Rol.DOCENTE]);
  const [docenteId, setDocenteId] = useState<string | null>(null);
  const [periodoActivo, setPeriodoActivo] = useState<Periodo | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [horariosExistentes, setHorariosExistentes] = useState<any[]>([]);
  
  const [cursoSeleccionado, setCursoSeleccionado] = useState<Curso | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulario de Teoría
  const [teoriaForm, setTeoriaForm] = useState({
    grupoId: '',
    dia: '' as DiaSemana | '',
    horaInicio: '',
    horaFin: '',
    ambienteId: '',
  });

  // Formulario de Laboratorio
  const [labForm, setLabForm] = useState({
    grupoId: '',
    dia: '' as DiaSemana | '',
    horaInicio: '',
    horaFin: '',
    ambienteId: '',
  });

  useEffect(() => {
    if (user?.docenteId) {
      setDocenteId(user.docenteId);
    } else if (user?.id) {
      apiGet<{ id: string }>(`/api/docentes/buscar`, { usuarioId: user.id })
        .then(res => setDocenteId(res.data?.id || null))
        .catch(() => setError('No se pudo encontrar el docente asociado'));
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!docenteId) return;
    setLoading(true);
    try {
      const [periodoRes, cursosRes, ambientesRes, horariosRes] = await Promise.all([
        apiGet<Periodo>('/api/periodos/activo'),
        apiGet<Curso[]>(`/api/docentes/${docenteId}/cursos`),
        apiGet<Ambiente[]>('/api/ambientes'),
        apiGet<any[]>('/api/horarios', { docenteId }),
      ]);

      setPeriodoActivo(periodoRes.data || null);
      setCursos(cursosRes.data || []);
      setAmbientes(ambientesRes.data || []);
      setHorariosExistentes(horariosRes.data || []);
    } catch (err) {
      setError('Error al cargar datos necesarios para la selección');
    } finally {
      setLoading(false);
    }
  }, [docenteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const aulas = useMemo(() => ambientes.filter(a => a.tipo === TipoAmbiente.AULA), [ambientes]);
  const laboratorios = useMemo(() => ambientes.filter(a => a.tipo === TipoAmbiente.LABORATORIO), [ambientes]);

  const getEstadoCurso = useCallback((curso: Curso) => {
    const horariosCurso = horariosExistentes.filter(h => h.cursoId === curso.id);
    const tieneTeoria = curso.horasTeoria > 0;
    const tieneLab = curso.horasLaboratorio > 0;
    
    const countTeoria = horariosCurso.filter(h => h.ambiente?.tipo === 'AULA').length;
    const countLab = horariosCurso.filter(h => h.ambiente?.tipo === 'LABORATORIO').length;

    if (tieneTeoria && tieneLab) {
      if (countTeoria > 0 && countLab > 0) return 'Completo';
      if (countTeoria > 0 || countLab > 0) return 'Parcial';
      return 'Sin horario';
    }
    if (tieneTeoria) return countTeoria > 0 ? 'Completo' : 'Sin horario';
    if (tieneLab) return countLab > 0 ? 'Completo' : 'Sin horario';
    return 'Completo';
  }, [horariosExistentes]);

  const handleGuardarHorario = useCallback(async (tipo: 'TEORIA' | 'LAB') => {
    if (!cursoSeleccionado || !periodoActivo || !docenteId) return;
    
    const form = tipo === 'TEORIA' ? teoriaForm : labForm;
    if (!form.grupoId || !form.dia || !form.horaInicio || !form.horaFin || !form.ambienteId) {
      setError('Completa todos los campos');
      return;
    }

    const hayCruce = horariosExistentes.some(h => 
      h.diaSemana === form.dia && 
      ((form.horaInicio >= h.horaInicio && form.horaInicio < h.horaFin) ||
       (form.horaFin > h.horaInicio && form.horaFin <= h.horaFin))
    );

    if (hayCruce) {
      setError('Conflicto: ya tienes clase ese día y hora');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiPost('/api/horarios', {
        periodoId: periodoActivo.id,
        cursoId: cursoSeleccionado.id,
        docenteId: docenteId,
        grupoId: form.grupoId,
        ambienteId: form.ambienteId,
        diaSemana: form.dia,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        estado: 'BORRADOR'
      });

      setSuccess(`Horario de ${tipo.toLowerCase()} guardado exitosamente`);
      
      const updatedHorarios = await apiGet<any[]>('/api/horarios', { docenteId });
      setHorariosExistentes(updatedHorarios.data || []);
      
      if (tipo === 'TEORIA') setTeoriaForm({ grupoId: '', dia: '', horaInicio: '', horaFin: '', ambienteId: '' });
      else setLabForm({ grupoId: '', dia: '', horaInicio: '', horaFin: '', ambienteId: '' });

    } catch (err: any) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar el horario');
    } finally {
      setSaving(false);
    }
  }, [cursoSeleccionado, periodoActivo, docenteId, teoriaForm, labForm, horariosExistentes]);

  if (loading || authLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-unt-blue" />
        <p className="text-slate-500 animate-pulse">Cargando carga académica y ambientes...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link 
            href="/dashboard/docente"
            className="group inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-unt-blue"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Volver al Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Selección de Horario</h1>
            <Badge variant="outline" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-full px-3 py-1 text-xs font-semibold">
              {periodoActivo?.nombre || '2026-I'} (Activo)
            </Badge>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Elige el día, hora y ambiente para cada uno de tus cursos asignados.
          </p>
        </div>
      </div>

      {error && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <ErrorAlert message={error} />
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-700 border border-emerald-200 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Columna Izquierda */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-unt-blue" />
              Cursos Asignados
            </h2>
            <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-none text-xs font-bold px-2 py-1 rounded-full">
              {cursos.length} total
            </Badge>
          </div>
          
          <div className="space-y-3">
            {cursos.map((curso) => {
              const estado = getEstadoCurso(curso);
              const isSelected = cursoSeleccionado?.id === curso.id;
              
              return (
                <button
                  key={curso.id}
                  onClick={() => {
                    setCursoSeleccionado(curso);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={cn(
                    "w-full text-left transition-all duration-200 rounded-xl border p-4 cursor-pointer transition-all hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md",
                    isSelected 
                      ? "bg-indigo-50 dark:bg-slate-700 border border-indigo-400 dark:border-indigo-500 shadow-md" 
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Badge className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {curso.codigo}
                        </Badge>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                          {curso.nombre}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> Ciclo {curso.ciclo}
                          </span>
                          <span>•</span>
                          <span>{curso.horasTeoria}T · {curso.horasPractica}P · {curso.horasLaboratorio}L</span>
                        </div>
                      </div>
                      <Badge 
                        className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded-full",
                          estado === 'Completo' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50" :
                          estado === 'Parcial' ? "bg-amber-100 text-amber-700" :
                          "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-700/50"
                        )}
                      >
                        {estado}
                      </Badge>
                    </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="lg:col-span-8">
          {cursoSeleccionado ? (
            <div className="space-y-6">
              <Card className="p-6 bg-slate-800 border border-slate-700 rounded-2xl">
                <div className="mb-8 border-b border-slate-700 pb-4">
                  <h2 className="text-white text-2xl font-bold">{cursoSeleccionado.nombre}</h2>
                </div>

                <div className="space-y-10">
                  {/* TEORÍA */}
                  {cursoSeleccionado.horasTeoria > 0 && (
                    <section className="space-y-4">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-white">📖 Horario de Teoría</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Grupo</label>
                          <Selector value={teoriaForm.grupoId} onValueChange={(val) => setTeoriaForm({ ...teoriaForm, grupoId: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="Selecciona grupo" /></SelectorTrigger>
                            <SelectorContent>
                              {cursoSeleccionado.grupos.map(g => <SelectorItem key={g.id} value={g.id}>Grupo {g.nombre}</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Día</label>
                          <div className="flex flex-wrap gap-2">
                            {DIAS_OPCIONES.map((dia) => (
                              <button
                                key={dia.value}
                                onClick={() => setTeoriaForm({ ...teoriaForm, dia: dia.value as DiaSemana })}
                                className={cn(
                                  "flex-1 py-2 px-4 text-sm font-bold rounded-xl transition-all",
                                  teoriaForm.dia === dia.value 
                                    ? "bg-indigo-500 border border-indigo-400 text-white shadow-lg shadow-indigo-500/30" 
                                    : "bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600"
                                )}
                              >
                                {dia.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Hora Inicio</label>
                          <Selector value={teoriaForm.horaInicio} onValueChange={(val) => setTeoriaForm({ ...teoriaForm, horaInicio: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="07:00" /></SelectorTrigger>
                            <SelectorContent>
                              {HORAS_OPCIONES.map(o => <SelectorItem key={o.value} value={o.value}>{o.label}</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Hora Fin</label>
                          <Selector value={teoriaForm.horaFin} onValueChange={(val) => setTeoriaForm({ ...teoriaForm, horaFin: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="09:00" /></SelectorTrigger>
                            <SelectorContent>
                              {HORAS_OPCIONES.filter(o => o.value > teoriaForm.horaInicio).map(o => <SelectorItem key={o.value} value={o.value}>{o.label}</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Aula</label>
                          <Selector value={teoriaForm.ambienteId} onValueChange={(val) => setTeoriaForm({ ...teoriaForm, ambienteId: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="Selecciona un aula" /></SelectorTrigger>
                            <SelectorContent>
                              {aulas.map(a => <SelectorItem key={a.id} value={a.id}>{a.codigo} - {a.nombre} (Cap: {a.capacidad})</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                      </div>
                      <Boton className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-3 transition-all shadow-lg shadow-indigo-600/20" onClick={() => handleGuardarHorario('TEORIA')}>Guardar teoría</Boton>
                    </section>
                  )}

                  {/* LABORATORIO */}
                  {cursoSeleccionado.horasLaboratorio > 0 && (
                    <section className="space-y-4 pt-6 border-t border-slate-700">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-white">🧪 Horario de Laboratorio</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Grupo</label>
                          <Selector value={labForm.grupoId} onValueChange={(val) => setLabForm({ ...labForm, grupoId: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="Selecciona grupo" /></SelectorTrigger>
                            <SelectorContent>
                              {cursoSeleccionado.grupos.map(g => <SelectorItem key={g.id} value={g.id}>Grupo {g.nombre}</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Día</label>
                          <div className="flex flex-wrap gap-2">
                            {DIAS_OPCIONES.map((dia) => (
                              <button
                                key={dia.value}
                                onClick={() => setLabForm({ ...labForm, dia: dia.value as DiaSemana })}
                                className={cn(
                                  "flex-1 py-2 px-4 text-sm font-bold rounded-xl transition-all",
                                  labForm.dia === dia.value 
                                    ? "bg-indigo-500 border border-indigo-400 text-white shadow-lg shadow-indigo-500/30" 
                                    : "bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600"
                                )}
                              >
                                {dia.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Hora Inicio</label>
                          <Selector value={labForm.horaInicio} onValueChange={(val) => setLabForm({ ...labForm, horaInicio: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="07:00" /></SelectorTrigger>
                            <SelectorContent>
                              {HORAS_OPCIONES.map(o => <SelectorItem key={o.value} value={o.value}>{o.label}</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                        <div className="space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Hora Fin</label>
                          <Selector value={labForm.horaFin} onValueChange={(val) => setLabForm({ ...labForm, horaFin: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="09:00" /></SelectorTrigger>
                            <SelectorContent>
                              {HORAS_OPCIONES.filter(o => o.value > labForm.horaInicio).map(o => <SelectorItem key={o.value} value={o.value}>{o.label}</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Laboratorio</label>
                          <Selector value={labForm.ambienteId} onValueChange={(val) => setLabForm({ ...labForm, ambienteId: val })}>
                            <SelectorTrigger className="bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"><SelectorValue placeholder="Selecciona laboratorio" /></SelectorTrigger>
                            <SelectorContent>
                              {laboratorios.map(l => <SelectorItem key={l.id} value={l.id}>{l.codigo} - {l.nombre} (Cap: {l.capacidad})</SelectorItem>)}
                            </SelectorContent>
                          </Selector>
                        </div>
                      </div>
                      <Boton className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-3 transition-all shadow-lg shadow-indigo-600/20" onClick={() => handleGuardarHorario('LAB')}>Guardar laboratorio</Boton>
                    </section>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent p-12 text-center"> 
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-slate-800"> 
                <svg className="h-10 w-10 text-indigo-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"> 
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /> 
                </svg> 
              </div> 
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Selecciona un curso</h3> 
              <p className="mt-2 max-w-xs text-sm text-slate-400 dark:text-slate-500"> 
                Haz clic en uno de tus cursos de la lista para comenzar a asignar horarios. 
              </p> 
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
