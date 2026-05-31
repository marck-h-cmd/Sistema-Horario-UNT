'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileDown, Loader2, Plus, TableIcon, ExternalLink, Users, MapPin, Search, BookOpen, CheckCircle2, X } from 'lucide-react';
import { FormField, FormModalFooter, FormSection, FormSelect } from '@/components/forms';
import { formControlClass } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { apiGet, apiPost, apiPut, apiDelete, ApiClientError } from '@/lib/api-client';
import { formatApiError, normalizeTimeHHmm } from '@/lib/format-api-error';
import { HORA_LIMITE_FIN_CLASES, validarFranjaHorariaPermitida } from '@/lib/horario-horas';
import { Formateadores } from '@/lib/formateadores';
import { useAuth, useRequireAuth } from '@/contexts/AuthContext';
import { usePeriodo } from '@/contexts/PeriodoContext';
import { DiaSemana, Rol } from '@prisma/client';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { useFiltrosHorario } from '@/hooks/useFiltrosHorario';
import { exportarHorarioPDF } from '@/utils/exportarHorarioPDF';
import { exportarHorarioExcel } from '@/utils/exportarHorarioExcel';

interface HorarioCell {
  id: string;
  horaInicio: string;
  horaFin: string;
  diaSemana: string;
  estado?: string;
  curso: { id: string; codigo: string; nombre: string; ciclo: number };
  docente: { id: string; usuario: { id: string; nombre: string; apellidos: string } };
  ambiente: { id: string; codigo: string; tipo?: string };
  grupo?: { id: string; nombre: string } | null;
}

interface ConflictoDetalle {
  id: string;
  tipoRegla: string;
  mensaje?: string;
  horario?: HorarioCell;
}

interface ConflictosPayload {
  totalConflictos: number;
  conflictos: ConflictoDetalle[];
}

interface CursoOpt {
  id: string;
  codigo: string;
  nombre: string;
}

interface DocenteOpt {
  id: string;
  usuario: { id: string; nombre: string; apellidos: string };
}

interface AmbienteOpt {
  id: string;
  codigo: string;
  nombre: string;
  tipo?: string;
  capacidad?: number;
  ubicacion?: string;
}

interface GrupoOpt {
  id: string;
  nombre: string;
}

interface CargaAcademicaRow {
  horasAsignadas?: number;
  docente: DocenteOpt;
}

interface DesfaseCarga {
  docente: string;
  curso: string;
  horasCarga: number;
  horasProgramadas: number;
  diferencia: number;
  estado: 'EXCEDE' | 'INCOMPLETO' | 'OK';
}

const DIAS: DiaSemana[] = [
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
];

const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 to 20

const DIA_LABEL: Record<string, string> = {
  LUNES: 'LUNES',
  MARTES: 'MARTES',
  MIERCOLES: 'MIÉRCOLES',
  JUEVES: 'JUEVES',
  VIERNES: 'VIERNES',
  SABADO: 'SÁBADO',
};

const CICLO_OPTIONS = [
  { value: '', label: 'Todos los ciclos' },
  { value: '1', label: 'Ciclo I' },
  { value: '2', label: 'Ciclo II' },
  { value: '3', label: 'Ciclo III' },
  { value: '4', label: 'Ciclo IV' },
  { value: '5', label: 'Ciclo V' },
  { value: '6', label: 'Ciclo VI' },
  { value: '7', label: 'Ciclo VII' },
  { value: '8', label: 'Ciclo VIII' },
  { value: '9', label: 'Ciclo IX' },
  { value: '10', label: 'Ciclo X' },
];

const CICLO_ROMANO: Record<string, string> = {
  '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
  '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X',
};

const COLORES_CURSO = [
  { bg: 'bg-blue-100',   border: 'border-l-blue-500',   text: 'text-blue-900',   badge: 'bg-blue-500'   },
  { bg: 'bg-green-100',  border: 'border-l-green-500',  text: 'text-green-900',  badge: 'bg-green-500'  },
  { bg: 'bg-purple-100', border: 'border-l-purple-500', text: 'text-purple-900', badge: 'bg-purple-500' },
  { bg: 'bg-amber-100',  border: 'border-l-amber-500',  text: 'text-amber-900',  badge: 'bg-amber-500'  },
  { bg: 'bg-rose-100',   border: 'border-l-rose-500',   text: 'text-rose-900',   badge: 'bg-rose-500'   },
  { bg: 'bg-teal-100',   border: 'border-l-teal-500',   text: 'text-teal-900',   badge: 'bg-teal-500'   },
  { bg: 'bg-orange-100', border: 'border-l-orange-500', text: 'text-orange-900', badge: 'bg-orange-500' },
  { bg: 'bg-cyan-100',   border: 'border-l-cyan-500',   text: 'text-cyan-900',   badge: 'bg-cyan-500'   },
];

const getColorForCurso = (cursoId: string) => {
  let hash = 0;
  for (let i = 0; i < cursoId.length; i++) {
    hash = cursoId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORES_CURSO.length;
  return COLORES_CURSO[index];
};

export default function HorariosPage() {
  const { loading: authLoading } = useRequireAuth([
    Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.OPERADOR,
  ]);
  const { can, user } = useAuth();
  const puedePublicar = can('PUBLICAR_HORARIOS');
  const { periodoSeleccionado, loading: periodoLoading } = usePeriodo();
  const periodoId = periodoSeleccionado?.id ?? '';

  const [horarios, setHorarios] = useState<HorarioCell[]>([]);
  const [loadingHor, setLoadingHor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictos, setConflictos] = useState<ConflictosPayload | null>(null);
  const [loadingConf, setLoadingConf] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const { filtros, setFiltros, actualizarFiltro, limpiarFiltros } = useFiltrosHorario(periodoId);
  useEffect(() => {
    if (periodoId) {
      setFiltros(prev => ({ ...prev, periodoId }));
    }
  }, [periodoId, setFiltros]);

  const [desfases, setDesfases] = useState<DesfaseCarga[]>([]);
  const [loadingDesfases, setLoadingDesfases] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [horasCargaDocente, setHorasCargaDocente] = useState<number | null>(null);
  const [cargaRows, setCargaRows] = useState<CargaAcademicaRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [loadingDocentesCurso, setLoadingDocentesCurso] = useState(false);
  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [docentes, setDocentes] = useState<DocenteOpt[]>([]);
  const [ambientes, setAmbientes] = useState<AmbienteOpt[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpt[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    cursoId: string; docenteId: string; ambienteId: string; grupoId: string; diaSemana: DiaSemana; horaInicio: string; horaFin: string;
  }>({
    cursoId: '', docenteId: '', ambienteId: '', grupoId: '', diaSemana: DiaSemana.LUNES, horaInicio: '08:00', horaFin: '10:00',
  });

  // Variables para filtros visuales y selects
  const [cursosAll, setCursosAll] = useState<CursoOpt[]>([]);
  const [docentesAll, setDocentesAll] = useState<DocenteOpt[]>([]);
  const [ambientesAll, setAmbientesAll] = useState<AmbienteOpt[]>([]);
  const [docentesSearch, setDocentesSearch] = useState('');

  const [diaResaltado, setDiaResaltado] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<string>('Todos');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('Todos');
  const [vistaTipo, setVistaTipo] = useState<'General' | 'Por Docente' | 'Por Aula'>('General');

  const fetchHorarios = useCallback(async () => {
    if (!filtros.periodoId) {
      setHorarios([]);
      return;
    }
    setLoadingHor(true);
    setError(null);
    try {
      const params: any = { limit: 500, page: 1, ...filtros };
      const res = await apiGet<HorarioCell[]>('/api/horarios', params);
      setHorarios(res.data ?? []);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Error al cargar horarios');
      setHorarios([]);
    } finally {
      setLoadingHor(false);
    }
  }, [filtros]);

  const fetchConflictos = useCallback(async () => {
    if (!periodoId) { setConflictos(null); return; }
    setLoadingConf(true);
    try {
      const res = await apiGet<ConflictosPayload>('/api/horarios/conflictos', { periodoId });
      setConflictos(res.data ? { totalConflictos: res.data.totalConflictos, conflictos: res.data.conflictos ?? [] } : null);
    } catch {
      setConflictos(null);
    } finally {
      setLoadingConf(false);
    }
  }, [periodoId]);

  const fetchDesfases = useCallback(async () => {
    if (!periodoId) { setDesfases([]); return; }
    setLoadingDesfases(true);
    try {
      const res = await apiGet<DesfaseCarga[]>('/api/horarios/desfases-carga', { periodoId });
      setDesfases(res.data ?? []);
    } catch {
      setDesfases([]);
    } finally {
      setLoadingDesfases(false);
    }
  }, [periodoId]);

  useEffect(() => {
    fetchHorarios();
    fetchConflictos();
    fetchDesfases();
  }, [fetchHorarios, fetchConflictos, fetchDesfases]);

  useEffect(() => {
    const params: any = { limit: 500 };
    if (filtros.ciclo) params.ciclo = filtros.ciclo;
    apiGet<CursoOpt[]>('/api/cursos', params).then(res => setCursosAll(res.data ?? []));
  }, [filtros.ciclo]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      apiGet<DocenteOpt[]>('/api/docentes', { search: docentesSearch, limit: 50 })
        .then(res => setDocentesAll(res.data ?? []));
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [docentesSearch]);

  useEffect(() => {
    apiGet<AmbienteOpt[]>('/api/ambientes', { limit: 100 }).then(res => setAmbientesAll(res.data ?? []));
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      try {
        const [c, a] = await Promise.all([
          apiGet<CursoOpt[]>('/api/cursos', { limit: 100, page: 1 }),
          apiGet<AmbienteOpt[]>('/api/ambientes', { limit: 100, page: 1 }),
        ]);
        const cL = c.data ?? [];
        const aL = a.data ?? [];
        setCursos(cL);
        setAmbientes(aL);
        if (!editingId) {
          setForm((f) => ({
            ...f,
            cursoId: cL[0]?.id ?? '',
            docenteId: '',
            ambienteId: aL[0]?.id ?? '',
          }));
        }
      } catch {
        toast.error('Error cargando datos del formulario');
      }
    })();
  }, [createOpen, editingId]);

  useEffect(() => {
    if (!createOpen || !form.cursoId) {
      setGrupos([]); setDocentes([]); return;
    }
    (async () => {
      setLoadingDocentesCurso(true);
      try {
        const [gruposRes, cargaRes] = await Promise.all([
          apiGet<GrupoOpt[]>('/api/grupos', { cursoId: form.cursoId }),
          apiGet<CargaAcademicaRow[]>('/api/carga-academica', { cursoId: form.cursoId, limit: 100, page: 1 }),
        ]);
        const g = gruposRes.data ?? [];
        const filasCarga = cargaRes.data ?? [];
        setGrupos(g);
        setCargaRows(filasCarga);

        const docentesDelCurso = filasCarga.map((row) => row.docente);
        const uniqueDocentes = Array.from(new Map(docentesDelCurso.map(item => [item.id, item])).values());
        
        setDocentes(uniqueDocentes);
        
        if (!editingId) {
          const primeraCarga = filasCarga[0];
          setHorasCargaDocente(primeraCarga?.horasAsignadas ?? null);
          setForm((f) => ({
            ...f,
            grupoId: g[0]?.id ?? '',
            docenteId: uniqueDocentes[0]?.id ?? '',
          }));
        } else {
          const actualCarga = filasCarga.find(r => r.docente.id === form.docenteId);
          setHorasCargaDocente(actualCarga?.horasAsignadas ?? null);
        }
      } catch {
        setGrupos([]); setDocentes([]);
      } finally {
        setLoadingDocentesCurso(false);
      }
    })();
  }, [createOpen, form.cursoId, editingId]);

  const notificarCambioHorario = async (docenteUsuarioId: string, titulo: string, mensaje: string) => {
    if (docenteUsuarioId) {
      try {
        await apiPost('/api/notificaciones/enviar', {
          usuarioId: docenteUsuarioId,
          tipo: 'CAMBIO_HORARIO',
          titulo,
          mensaje,
          prioridad: 'MEDIA',
          canal: 'SISTEMA',
        });
        await apiPost('/api/notificaciones/enviar', {
          usuarioId: docenteUsuarioId,
          tipo: 'CAMBIO_HORARIO',
          titulo,
          mensaje,
          prioridad: 'MEDIA',
          canal: 'CORREO',
        });
      } catch (e) {
        console.error('Error enviando notificación al docente:', e);
      }
    }

    if (user?.id && user.id !== docenteUsuarioId) {
      try {
        await apiPost('/api/notificaciones/enviar', {
          usuarioId: user.id,
          tipo: 'CAMBIO_HORARIO',
          titulo,
          mensaje,
          prioridad: 'MEDIA',
          canal: 'SISTEMA',
        });
        await apiPost('/api/notificaciones/enviar', {
          usuarioId: user.id,
          tipo: 'CAMBIO_HORARIO',
          titulo,
          mensaje,
          prioridad: 'MEDIA',
          canal: 'CORREO',
        });
      } catch (e) {
        console.error('Error enviando notificación al administrador:', e);
      }
    }
  };

  const getDisponibilidadAmbiente = (ambienteId: string) => {
    const { diaSemana, horaInicio, horaFin } = form;
    
    const parseTime = (t: string) => {
      const parts = t.split(':');
      if (parts.length < 2) return NaN;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };
    
    const start = parseTime(horaInicio);
    const end = parseTime(horaFin);

    if (isNaN(start) || isNaN(end) || start >= end) return { disponible: false, mensaje: 'Hora inválida' };

    const cruces = horarios.filter(h => {
      if (editingId && h.id === editingId) return false;
      if (h.ambiente.id !== ambienteId) return false;
      if (h.diaSemana !== diaSemana) return false;
      
      const hStart = parseTime(h.horaInicio);
      const hEnd = parseTime(h.horaFin);
      
      return Math.max(start, hStart) < Math.min(end, hEnd);
    });

    if (cruces.length > 0) {
      return { disponible: false, mensaje: `Ocupado (${cruces[0].curso.codigo})` };
    }
    return { disponible: true, mensaje: 'Sí' };
  };

  const handleEditOpen = (h: HorarioCell) => {
    setEditingId(h.id);
    setForm({
      cursoId: h.curso.id || '',
      docenteId: h.docente.id || '',
      ambienteId: h.ambiente.id || '',
      grupoId: h.grupo?.id || '',
      diaSemana: h.diaSemana as DiaSemana,
      horaInicio: h.horaInicio.slice(0, 5),
      horaFin: h.horaFin.slice(0, 5),
    });
    setCreateOpen(true);
  };

  const handleDelete = async (h: HorarioCell) => {
    if (!confirm('¿Está seguro de eliminar este horario?')) return;
    try {
      await apiDelete(`/api/horarios/${h.id}`);
      toast.success('Horario eliminado correctamente');
      
      const docenteUsuarioId = h.docente.usuario?.id || '';
      await notificarCambioHorario(
        docenteUsuarioId,
        'Horario Eliminado',
        `Se ha eliminado el horario del día ${DIA_LABEL[h.diaSemana]} de ${h.horaInicio} a ${h.horaFin} en el ambiente ${h.ambiente.codigo}.`
      );
      
      fetchHorarios();
      fetchConflictos();
      fetchDesfases();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al eliminar horario');
    }
  };

  const handleConfirmHorario = async (id: string, h: HorarioCell) => {
    if (!confirm('¿Está seguro de confirmar este horario?')) return;
    try {
      await apiPost(`/api/horarios/${id}/confirmar`, {});
      toast.success('Horario confirmado correctamente');
      
      const docenteUsuarioId = h.docente.usuario?.id || '';
      await notificarCambioHorario(
        docenteUsuarioId,
        'Horario Confirmado',
        `Se ha confirmado tu horario para el curso ${h.curso.nombre} el día ${DIA_LABEL[h.diaSemana]} de ${h.horaInicio} a ${h.horaFin} en el ambiente ${h.ambiente.codigo}.`
      );
      
      fetchHorarios();
      fetchConflictos();
      fetchDesfases();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al confirmar horario');
    }
  };

  const handleCreate = async () => {
    if (!periodoId) return;

    if (!form.cursoId || !form.docenteId || !form.ambienteId) {
      toast.error('Complete curso, docente y ambiente');
      return;
    }

    const horaInicio = normalizeTimeHHmm(form.horaInicio);
    const horaFin = normalizeTimeHHmm(form.horaFin);
    if (!/^\d{2}:\d{2}$/.test(horaInicio) || !/^\d{2}:\d{2}$/.test(horaFin)) {
      toast.error('Use formato de hora válido (HH:mm)'); return;
    }
    
    if (horaInicio < '07:00' || horaFin > '21:00') {
      toast.error('El horario debe estar entre las 07:00 y las 21:00'); return;
    }

    const franja = validarFranjaHorariaPermitida(horaInicio, horaFin);
    if (!franja.valido) {
      toast.error(franja.mensaje ?? 'Franja horaria no permitida');
      setFormError(franja.mensaje ?? null); return;
    }

    setFormError(null);
    setSavingCreate(true);
    try {
      if (editingId) {
        await apiPut(`/api/horarios/${editingId}`, {
          periodoId, cursoId: form.cursoId, docenteId: form.docenteId, ambienteId: form.ambienteId,
          grupoId: form.grupoId || undefined, diaSemana: form.diaSemana, horaInicio, horaFin,
        });
        toast.success('Horario actualizado correctamente');

        const targetDocente = docentesAll.find(d => d.id === form.docenteId);
        const docenteUsuarioId = targetDocente?.usuario?.id || '';
        await notificarCambioHorario(
          docenteUsuarioId,
          'Horario Modificado',
          `Se ha modificado el horario para la asignatura. Nuevo horario: ${DIA_LABEL[form.diaSemana]} de ${horaInicio} a ${horaFin}.`
        );
      } else {
        await apiPost('/api/horarios', {
          periodoId, cursoId: form.cursoId, docenteId: form.docenteId, ambienteId: form.ambienteId,
          grupoId: form.grupoId || undefined, diaSemana: form.diaSemana, horaInicio, horaFin,
        });
        toast.success('Horario creado correctamente');

        const targetDocente = docentesAll.find(d => d.id === form.docenteId);
        const docenteUsuarioId = targetDocente?.usuario?.id || '';
        await notificarCambioHorario(
          docenteUsuarioId,
          'Nuevo Horario Asignado',
          `Se ha programado una nueva sesión en el día ${DIA_LABEL[form.diaSemana]} de ${horaInicio} a ${horaFin}.`
        );
      }
      setCreateOpen(false);
      setEditingId(null);
      fetchHorarios(); fetchConflictos(); fetchDesfases();
    } catch (e) {
      const msg = formatApiError(e, 'No se pudo guardar el horario');
      setFormError(msg); toast.error(msg);
    } finally {
      setSavingCreate(false);
    }
  };

  const validarTodo = async () => {
    if (!periodoId) return;
    setBusyAction(true);
    try {
      const res = await apiPost<{ horariosConConflictos: number }>('/api/horarios/validar-todo', { periodoId });
      toast.success(`Validación terminada. Con conflictos: ${res.data?.horariosConConflictos ?? '—'}`);
      fetchConflictos(); fetchDesfases();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al validar');
    } finally {
      setBusyAction(false);
    }
  };

  const descargarPdfConfirmados = async () => {
    if (!periodoId || horarios.length === 0) return;
    setDownloadingPdf(true);
    try {
      const periodoNombre = periodoSeleccionado?.nombre || 'General';
      const cicloNombre = filtros.ciclo ? `Ciclo ${CICLO_ROMANO[filtros.ciclo] || filtros.ciclo}` : 'Todos los ciclos';
      await exportarHorarioPDF(horarios, 'HORARIO ACADÉMICO', `${periodoNombre} - ${cicloNombre}`);
      toast.success('PDF exportado');
    } catch (e: any) {
      toast.error('Error al generar PDF: ' + e.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleExportarExcel = async () => {
    if (!periodoId || horarios.length === 0) return;
    setDownloadingExcel(true);
    try {
      const titulo = `Horario Académico - ${periodoSeleccionado?.nombre || 'General'}`;
      await exportarHorarioExcel(horarios, titulo);
      toast.success('Excel exportado');
    } catch (e: any) {
      toast.error('Error al generar Excel: ' + e.message);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const publicar = async () => {
    if (!periodoId || !puedePublicar) return;
    setBusyAction(true);
    try {
      await apiPost('/api/horarios/publicar', { periodoId });
      toast.success('Horarios publicados');
      fetchHorarios();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al publicar');
    } finally {
      setBusyAction(false);
    }
  };

  const columnsConflictos: Column<ConflictoDetalle>[] = [
    { key: 't', header: 'Tipo', cell: (r) => r.tipoRegla },
    { key: 'm', header: 'Detalle', cell: (r) => <span className="text-sm text-gray-700 dark:text-slate-300">{r.mensaje || r.horario?.curso?.codigo || '—'}</span> },
  ];

  const horariosFiltrados = useMemo(() => {
    return horarios.filter(h => {
      if (estadoFiltro !== 'Todos' && h.estado !== estadoFiltro) {
        if (h.estado) return h.estado === estadoFiltro;
      }
      if (grupoFiltro !== 'Todos') {
        return h.grupo?.nombre === grupoFiltro;
      }
      return true;
    });
  }, [horarios, estadoFiltro, grupoFiltro]);

  const getTotalHoras = (dia: string) => {
    return horariosFiltrados
      .filter((h) => h.diaSemana === dia && h.horaInicio && h.horaFin)
      .reduce((acc, h) => {
        const inicio = parseInt(h.horaInicio!.split(':')[0], 10);
        const fin = parseInt(h.horaFin!.split(':')[0], 10);
        return acc + (fin - inicio);
      }, 0);
  };
  
  const totalSemanal = DIAS.reduce((acc, dia) => acc + getTotalHoras(dia), 0);

  const cursosUnicos = useMemo(() => {
    const map = new Map();
    horariosFiltrados.forEach(h => {
       if (!map.has(h.curso.codigo)) map.set(h.curso.codigo, h.curso);
    });
    return Array.from(map.values());
  }, [horariosFiltrados]);

  // Agrupar clases por carriles (lanes) para cada día
  const lanesPorDia = useMemo(() => {
    const res: Record<string, HorarioCell[][]> = {};
    const parseTime = (t: string) => parseInt(t.split(':')[0], 10);
    
    DIAS.forEach(dia => {
      const dayClasses = horariosFiltrados.filter(h => h.diaSemana === dia && h.horaInicio && h.horaFin);
      const lanes: HorarioCell[][] = [];
      const sortedClasses = [...dayClasses].sort((a, b) => parseTime(a.horaInicio!) - parseTime(b.horaInicio!));

      sortedClasses.forEach(c => {
        const start = parseTime(c.horaInicio);
        const end = parseTime(c.horaFin);

        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
          const hasOverlap = lanes[i].some(existing => {
            const estart = parseTime(existing.horaInicio);
            const eend = parseTime(existing.horaFin);
            return Math.max(start, estart) < Math.min(end, eend);
          });
          if (!hasOverlap) {
            lanes[i].push(c);
            placed = true;
            break;
          }
        }
        if (!placed) {
          lanes.push([c]);
        }
      });

      if (lanes.length === 0) {
        lanes.push([]);
      }
      res[dia] = lanes;
    });
    return res;
  }, [horariosFiltrados]);

  const totalLanes = useMemo(() => {
    return DIAS.reduce((sum, d) => sum + (lanesPorDia[d]?.length || 1), 0);
  }, [lanesPorDia]);

  const minTableWidth = useMemo(() => {
    return Math.max(1000, totalLanes * 100 + 160); // 100px por carril, más 80px por cada columna de hora lateral
  }, [totalLanes]);


  if (authLoading || periodoLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a365d]" />
      </div>
    );
  }

  if (!periodoId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1a365d]">Gestión de Horarios</h1>
            <p className="text-slate-500 mt-1">Período no seleccionado — Vista general</p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seleccione un período académico arriba para ver y editar horarios.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a365d]">Gestión de Horarios</h1>
          <p className="text-slate-500 mt-1">Período {periodoSeleccionado?.nombre || '2026-I'} — {vistaTipo}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            disabled={downloadingPdf || horariosFiltrados.length === 0}
            onClick={descargarPdfConfirmados}
            className="border-[#1a365d] text-[#1a365d] hover:bg-slate-100"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            disabled={downloadingExcel || horariosFiltrados.length === 0}
            onClick={handleExportarExcel}
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            <TableIcon className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          {puedePublicar && (
            <Button
              variant="secondary"
              disabled={busyAction}
              onClick={publicar}
              className="bg-slate-200 text-slate-800 hover:bg-slate-300"
            >
              Publicar todos
            </Button>
          )}
          <Button
            onClick={() => {
              setEditingId(null);
              setForm({
                cursoId: '', docenteId: '', ambienteId: '', grupoId: '', diaSemana: DiaSemana.LUNES, horaInicio: '08:00', horaFin: '10:00',
              });
              setCreateOpen(true);
            }}
            className="bg-[#1a365d] hover:bg-[#1a365d]/90 text-white font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Asignar horario
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.open('/horarios', '_blank')}
            className="text-slate-600 hover:text-slate-900"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Vista Pública
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
        <strong>Restricción horaria:</strong> no se programan clases después de las 21:00 (9:00 p.m.).
      </div>



      {error && <ErrorAlert message={error} onRetry={fetchHorarios} />}

      {/* FILTROS FUNCIONALES */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              {['General', 'Por Docente', 'Por Aula'].map(v => (
                <button
                  key={v}
                  onClick={() => {
                    setVistaTipo(v as any);
                    if (v === 'General') {
                      limpiarFiltros();
                      setEstadoFiltro('Todos');
                      setGrupoFiltro('Todos');
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    vistaTipo === v ? "bg-white dark:bg-slate-800 shadow-sm text-[#1a365d] dark:text-unt-gold-light" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            <select
              value={filtros.ciclo || ''}
              onChange={(e) => actualizarFiltro('ciclo', e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:border-[#1a365d] focus:outline-none focus:ring-1 focus:ring-[#1a365d] min-w-[140px]"
            >
              {CICLO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar docente..."
                value={docentesSearch}
                onChange={e => {
                  const val = e.target.value;
                  setDocentesSearch(val);
                  const found = docentesAll.find(d => Formateadores.nombreUsuario(d.usuario) === val);
                  if (found) {
                    actualizarFiltro('docenteId', found.id);
                  } else if (!val) {
                    actualizarFiltro('docenteId', '');
                  }
                }}
                list="docentes-list"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 pl-9 pr-3 py-2 text-sm focus:border-[#1a365d] focus:outline-none focus:ring-1 focus:ring-[#1a365d]"
              />
              <datalist id="docentes-list">
                {docentesAll.map(d => (
                  <option key={d.id} value={Formateadores.nombreUsuario(d.usuario)} />
                ))}
              </datalist>
            </div>

            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <select
                value={filtros.ambienteId || ''}
                onChange={(e) => actualizarFiltro('ambienteId', e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:border-[#1a365d] focus:outline-none focus:ring-1 focus:ring-[#1a365d]"
              >
                <option value="">Tipo ambiente...</option>
                {ambientesAll.map((a) => (
                  <option key={a.id} value={a.id}>{a.codigo} {(a as any).tipo ? `(${a.tipo})` : ''}</option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={() => {
                limpiarFiltros();
                setEstadoFiltro('Todos');
                setGrupoFiltro('Todos');
              }} 
              className="text-sm font-medium text-[#1a365d] hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mr-2">Día:</span>
            {DIAS.map(d => (
              <button
                key={d}
                onClick={() => setDiaResaltado(diaResaltado === d ? null : d)}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-full transition-colors border",
                  diaResaltado === d 
                    ? "bg-[#1a365d] text-white border-[#1a365d]" 
                    : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                )}
              >
                {DIA_LABEL[d].slice(0, 3)}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mr-2">Estado:</span>
              {['Todos', 'CONFIRMADO', 'PUBLICADO', 'BORRADOR'].map(est => (
                <button
                  key={est}
                  onClick={() => setEstadoFiltro(est)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-colors border",
                    estadoFiltro === est
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700"
                      : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                  )}
                >
                  {est}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mr-2">Grupo:</span>
              {['Todos', 'A', 'B', 'C'].map(grp => (
                <button
                  key={grp}
                  onClick={() => setGrupoFiltro(grp)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-colors border",
                    grupoFiltro === grp
                      ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"
                      : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                  )}
                >
                  {grp === 'Todos' ? 'Todos' : `Grupo ${grp}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LEYENDA */}
      {cursosUnicos.length > 0 && (
        <div className="flex flex-wrap gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm items-center">
          <div className="flex items-center gap-2 mr-2">
             <BookOpen className="w-4 h-4 text-slate-400" />
             <span className="text-sm font-semibold text-slate-600">Asignaturas:</span>
          </div>
          {cursosUnicos.map(c => {
            const col = getColorForCurso(c.codigo);
            return (
              <div key={c.codigo} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", col.badge)}></span>
                <span><strong className="text-slate-900">{c.codigo}</strong>: {c.nombre}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* GRILLA CON ROWSPAN */}
      <div className="shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="overflow-x-auto">
          {loadingHor ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#1a365d]" />
            </div>
          ) : (
            <table 
              style={{ minWidth: `${minTableWidth}px` }}
              className="w-full text-sm text-left border-collapse table-fixed"
            >
              <thead className="bg-[#1a365d] text-white">
                <tr>
                  <th className="py-3 px-4 text-center font-semibold w-24 border-b border-slate-700">HORA</th>
                  {DIAS.map(d => {
                    const lanesCount = lanesPorDia[d]?.length || 1;
                    const percentWidth = (lanesCount / totalLanes) * 100;
                    return (
                      <th 
                        key={d} 
                        style={{ width: `${percentWidth}%` }}
                        className={cn(
                          "py-3 px-2 text-center font-bold tracking-wider border-b border-slate-700",
                          diaResaltado === d && "bg-blue-800"
                        )}
                      >
                        {DIA_LABEL[d]}
                      </th>
                    );
                  })}
                  <th className="py-3 px-4 text-center font-semibold w-24 border-b border-slate-700">HORA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {HORAS.map((horaNum, rowIndex) => (
                  <tr 
                    key={horaNum} 
                    className={cn(
                      "group h-16",
                      rowIndex % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/30 dark:bg-slate-700/20"
                    )}
                  >
                    {/* HORA Izquierda */}
                    <td className="py-2 px-2 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-sm whitespace-nowrap">
                      {`${horaNum.toString().padStart(2, '0')}:00`}
                      <br />
                      <span className="text-xs opacity-70">{`${(horaNum + 1).toString().padStart(2, '0')}:00`}</span>
                    </td>

                    {/* Celdas de Días */}
                    {DIAS.map(dia => {
                      if (rowIndex > 0) return null; // Solo renderizar el TD en la primera fila (rowSpan={14})

                      const dayClasses = horariosFiltrados.filter(h => h.diaSemana === dia);
                      const lanes = lanesPorDia[dia] || [[]];
                      const parseTime = (t: string) => parseInt(t.split(':')[0], 10);

                      return (
                        <td 
                          key={dia} 
                          rowSpan={14}
                          className={cn(
                            "p-0 border-r border-b border-slate-200 align-top transition-colors relative h-full min-h-[600px] overflow-hidden",
                            diaResaltado === dia && "bg-blue-50/30"
                          )}
                        >
                          <div className="absolute inset-0 flex flex-row divide-x divide-slate-200 h-full w-full">
                            {lanes.map((lane, laneIdx) => {
                              // Generar bloques y espacios vacíos para esta lane de 7:00 a 21:00 (14 horas)
                              const laneItems: Array<{
                                type: 'class' | 'empty';
                                duration: number;
                                class?: typeof dayClasses[0];
                                startHour: number;
                                endHour: number;
                              }> = [];

                              let currentHour = 7;
                              const laneClasses = [...lane].sort((a, b) => parseTime(a.horaInicio) - parseTime(b.horaInicio));

                              laneClasses.forEach(c => {
                                const start = parseTime(c.horaInicio);
                                const end = parseTime(c.horaFin);

                                if (start > currentHour) {
                                  laneItems.push({
                                    type: 'empty',
                                    duration: start - currentHour,
                                    startHour: currentHour,
                                    endHour: start
                                  });
                                }
                                laneItems.push({
                                  type: 'class',
                                  duration: end - start,
                                  class: c,
                                  startHour: start,
                                  endHour: end
                                });
                                currentHour = end;
                              });

                              if (currentHour < 21) {
                                laneItems.push({
                                  type: 'empty',
                                  duration: 21 - currentHour,
                                  startHour: currentHour,
                                  endHour: 21
                                });
                              }

                              return (
                                <div 
                                  key={laneIdx} 
                                  className="flex flex-col flex-1 min-w-0 h-full justify-between items-stretch"
                                >

                                  {laneItems.map((item, itemIdx) => {
                                    if (item.type === 'class') {
                                      const h = item.class!;
                                      const col = getColorForCurso(h.curso.codigo);
                                      const esLab = h.ambiente.codigo.toUpperCase().includes('LAB') || (h.ambiente as any).tipo === 'LABORATORIO';
                                      const isBorrador = h.estado === 'BORRADOR';

                                      const laneCount = lanes.length;
                                      const isCompact = laneCount > 1;
                                      const isSuperCompact = laneCount >= 3 || item.duration <= 1;

                                      return (
                                        <div
                                          key={h.id}
                                          style={{ flexGrow: item.duration, flexBasis: 0 }}
                                          className="flex flex-col w-full group relative overflow-hidden"
                                        >
                                          {item.duration <= 1 ? (
                                            <div
                                              className={cn(
                                                "relative flex flex-col justify-between h-full w-full border-l-4 transition-all hover:shadow-inner cursor-pointer flex-1 border-b border-b-black/5 overflow-hidden p-1.5",
                                                col.bg, col.border, col.text
                                              )}
                                            >
                                              {/* Fila 1: Código de curso y Tipo */}
                                              <div className="flex items-center justify-between gap-1 w-full overflow-hidden leading-none mb-0.5">
                                                <span className="font-bold text-[10px] truncate leading-none">
                                                  {h.curso.codigo}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <span className={cn(
                                                    "font-bold rounded text-white shadow-sm text-[7.5px] px-1 py-0 leading-none",
                                                    col.badge
                                                  )}>
                                                    {esLab ? 'LAB' : 'TEO'}
                                                  </span>
                                                  
                                                  {isBorrador && (
                                                    <div className="flex items-center gap-0.5 bg-white/70 p-0.5 rounded shadow-sm opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleConfirmHorario(h.id, h);
                                                        }}
                                                        title="Confirmar"
                                                        className="p-0.5 hover:bg-green-100 text-green-600 rounded transition-colors"
                                                      >
                                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                      </button>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleEditOpen(h);
                                                        }}
                                                        title="Editar"
                                                        className="p-0.5 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                                                      >
                                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                      </button>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleDelete(h);
                                                        }}
                                                        title="Eliminar"
                                                        className="p-0.5 hover:bg-red-100 text-red-600 rounded transition-colors"
                                                      >
                                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Fila 2: Grupo y Ambiente (sin iconos, combinados) */}
                                              <div className="text-[9px] font-bold opacity-90 truncate leading-none mt-auto pt-1 border-t border-black/5">
                                                {h.grupo?.nombre ? `Gr. ${h.grupo.nombre}` : 'Sin Gr.'} • {h.ambiente.codigo}
                                              </div>
                                            </div>
                                          ) : (
                                            <div
                                              className={cn(
                                                "relative flex flex-col h-full w-full border-l-4 transition-all hover:shadow-inner cursor-pointer flex-1 border-b border-b-black/5 overflow-hidden",
                                                isSuperCompact ? "p-1.5" : isCompact ? "p-2" : "p-3",
                                                col.bg, col.border, col.text
                                              )}
                                            >
                                              <div className={cn("flex justify-between items-start gap-1", isSuperCompact ? "mb-1" : "mb-2")}>
                                                <span className={cn(
                                                  "font-bold rounded text-white shadow-sm shrink-0",
                                                  isSuperCompact ? "text-[8px] px-1 py-0" : "text-[10px] px-1.5 py-0.5",
                                                  col.badge
                                                )}>
                                                  {esLab ? 'LAB' : 'TEORÍA'}
                                                </span>
                                                
                                                <div className="flex items-center gap-1">
                                                  <span className={cn(
                                                    "font-mono opacity-80 font-semibold whitespace-nowrap bg-white/40 px-1 rounded shrink-0",
                                                    isSuperCompact ? "text-[7.5px]" : "text-[10px]"
                                                  )}>
                                                    {h.horaInicio} - {h.horaFin}
                                                  </span>
                                                  
                                                  {isBorrador && (
                                                    <div className="flex items-center gap-0.5 bg-white/70 p-0.5 rounded shadow-sm opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleConfirmHorario(h.id, h);
                                                        }}
                                                        title="Confirmar"
                                                        className="p-0.5 hover:bg-green-100 text-green-600 rounded transition-colors"
                                                      >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                      </button>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleEditOpen(h);
                                                        }}
                                                        title="Editar"
                                                        className="p-0.5 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                                                      >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                      </button>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleDelete(h);
                                                        }}
                                                        title="Eliminar"
                                                        className="p-0.5 hover:bg-red-100 text-red-600 rounded transition-colors"
                                                      >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              <div className={cn(
                                                "font-bold leading-tight",
                                                isSuperCompact ? "text-[10px] mb-0" : isCompact ? "text-xs mb-0.5" : "text-sm mb-0.5"
                                              )}>
                                                {h.curso.codigo}
                                              </div>
                                              
                                              <div 
                                                className={cn(
                                                  "leading-snug opacity-90",
                                                  isSuperCompact ? "hidden" : isCompact ? "text-[9px] line-clamp-1 mb-1" : "text-[11px] line-clamp-2 mb-2"
                                                )} 
                                                title={h.curso.nombre}
                                              >
                                                {h.curso.nombre}
                                              </div>
                                              
                                              <div className={cn(
                                                "mt-auto flex opacity-85 font-medium pt-1 border-t border-black/5 gap-1 w-full overflow-hidden",
                                                isCompact 
                                                  ? "flex-col items-stretch text-[8px]" 
                                                  : "flex-row justify-between items-center text-[10px]"
                                              )}>
                                                <div className="flex items-center gap-0.5 bg-white/40 px-1 py-0.5 rounded truncate max-w-full justify-center">
                                                  {!isCompact && <Users className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                                                  <span className="truncate text-center w-full">{h.grupo?.nombre ? `Gr. ${h.grupo.nombre}` : 'Sin Gr.'}</span>
                                                </div>
                                                <div className="flex items-center gap-0.5 bg-white/40 px-1 py-0.5 rounded truncate max-w-full justify-center">
                                                  {!isCompact && <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                                                  <span className="truncate text-center w-full">{h.ambiente.codigo}</span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div
                                          key={itemIdx}
                                          style={{ flexGrow: item.duration, flexBasis: 0 }}
                                          className="border-b last:border-b-0 border-slate-200/50 w-full hover:bg-slate-50/50 transition-colors flex flex-col justify-center items-center"
                                        >
                                          <div className="w-full h-full min-h-[30px] rounded border border-transparent" />
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}

                    {/* HORA Derecha */}
                    <td className="py-2 px-2 text-center bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-sm whitespace-nowrap">
                      {`${horaNum.toString().padStart(2, '0')}:00`}
                      <br />
                      <span className="text-xs opacity-70">{`${(horaNum + 1).toString().padStart(2, '0')}:00`}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-800 text-white font-bold shadow-inner">
                <tr>
                  <td className="py-3 px-4 text-center border-t border-slate-700">TOTALES</td>
                  {DIAS.map(dia => (
                    <td key={dia} className="py-3 px-4 text-center border-t border-slate-700 border-r border-slate-700/50">
                      {getTotalHoras(dia)}h
                    </td>
                  ))}
                  <td className="py-3 px-4 text-center border-t border-slate-700 bg-[#1a365d]">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] text-blue-200 font-normal leading-tight uppercase">Semanal</span>
                      <span className="bg-blue-500 text-white px-2 py-0.5 rounded-md text-sm shadow-sm">{totalSemanal}h</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-[#1a365d]">Conflictos de validación</h2>
        {loadingConf ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#1a365d]" />
        ) : conflictos && conflictos.totalConflictos > 0 ? (
          <DataTable
            columns={columnsConflictos}
            data={conflictos.conflictos.slice(0, 50)}
            keyExtractor={(r) => r.id}
            emptyTitle="Sin conflictos"
          />
        ) : (
                    <p className="text-sm text-gray-500 dark:text-slate-400">No hay registros de conflicto con cumple = false.</p>
        )}
      </div>

      {/* MODAL CREAR/EDITAR HORARIO */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setFormError(null);
            setEditingId(null);
            setForm({
              cursoId: '', docenteId: '', ambienteId: '', grupoId: '', diaSemana: DiaSemana.LUNES, horaInicio: '08:00', horaFin: '10:00',
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar horario' : 'Asignar horario'}</DialogTitle>
          </DialogHeader>

          {formError && (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {formError}
            </p>
          )}
          <div className="grid max-h-[65vh] gap-6 overflow-y-auto py-2 md:grid-cols-2">
            <FormSection title="Curso y docente">
              <FormField label="Curso" htmlFor="hor-curso" required>
                <FormSelect
                  id="hor-curso"
                  value={form.cursoId}
                  onChange={(e) => setForm((f) => ({ ...f, cursoId: e.target.value }))}
                >
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Grupo (opcional)" htmlFor="hor-grupo">
                <FormSelect
                  id="hor-grupo"
                  value={form.grupoId}
                  onChange={(e) => setForm((f) => ({ ...f, grupoId: e.target.value }))}
                >
                  <option value="">— Sin grupo —</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Docente" htmlFor="hor-docente" required>
                {loadingDocentesCurso ? (
                  <p className="text-sm text-slate-500">Cargando docentes del curso…</p>
                ) : docentes.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No hay docentes con carga académica en este curso. Asigne uno en{' '}
                    <strong>Carga académica</strong> antes de crear el horario.
                  </p>
                ) : (
                  <FormSelect
                    id="hor-docente"
                    value={form.docenteId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const fila = cargaRows.find((r) => r.docente.id === id);
                      setHorasCargaDocente(fila?.horasAsignadas ?? null);
                      setForm((f) => ({ ...f, docenteId: id }));
                    }}
                  >
                    {docentes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {Formateadores.nombreUsuario(d.usuario)}
                      </option>
                    ))}
                  </FormSelect>
                )}
                {horasCargaDocente != null && horasCargaDocente > 0 && (
                  <p className="mt-1 text-xs text-slate-600">
                    Carga académica asignada: <strong>{horasCargaDocente}h</strong> en este curso
                  </p>
                )}
              </FormField>
            </FormSection>

            <FormSection title="Fecha y hora">
              <FormField label="Ambiente" htmlFor="hor-ambiente" required>
                <FormSelect
                  id="hor-ambiente"
                  value={form.ambienteId}
                  onChange={(e) => setForm((f) => ({ ...f, ambienteId: e.target.value }))}
                >
                  {ambientes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} — {a.nombre}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Día" htmlFor="hor-dia" required>
                <FormSelect
                  id="hor-dia"
                  value={form.diaSemana}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, diaSemana: e.target.value as DiaSemana }))
                  }
                >
                  {DIAS.map((d) => (
                    <option key={d} value={d}>
                      {DIA_LABEL[d] ?? d}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Inicio (Mín. 07:00)" htmlFor="hor-inicio" required>
                  <Input
                    id="hor-inicio"
                    type="time"
                    min="07:00"
                    max="20:59"
                    className={cn(formControlClass(), form.horaInicio < '07:00' && 'border-red-500')}
                    value={form.horaInicio}
                    onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))}
                  />
                </FormField>
                <FormField label="Fin (Máx. 21:00)" htmlFor="hor-fin" required>
                  <Input
                    id="hor-fin"
                    type="time"
                    min="07:00"
                    max="21:00"
                    className={cn(formControlClass(), form.horaFin > '21:00' && 'border-red-500')}
                    value={form.horaFin}
                    onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))}
                  />
                </FormField>
              </div>
              {(form.horaInicio < '07:00' || form.horaFin > '21:00') && (
                <p className="text-red-500 text-xs font-medium mt-1 text-center">
                  El horario debe estar entre las 07:00 y las 21:00
                </p>
              )}
            </FormSection>
          </div>

          {/* TABLAS DE DISPONIBILIDAD DE AMBIENTES */}
          {form.cursoId && form.horaInicio && form.horaFin && (() => {
            const selectedCurso = cursos.find(c => c.id === form.cursoId);
            const aulas = ambientesAll.filter(a => a.tipo === 'AULA');
            const labs = ambientesAll.filter(a => a.tipo === 'LABORATORIO');
            
            return (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-2">
                <h3 className="text-sm font-bold text-[#1a365d] dark:text-blue-400 mb-4 uppercase tracking-wide">
                  Configuración: Ambientes disponibles por curso
                  {selectedCurso && <span className="block font-normal text-slate-500 mt-1 capitalize normal-case">Curso: {selectedCurso.nombre}</span>}
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* TEORÍA */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Ambientes para TEORÍA:</h4>
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden text-xs max-h-60 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Ambiente</th>
                            <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400 text-center">Capacidad</th>
                            <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Disponible</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {aulas.map(a => {
                            const { disponible, mensaje } = getDisponibilidadAmbiente(a.id);
                            return (
                              <tr 
                                key={a.id} 
                                className={cn(
                                  disponible ? "bg-white dark:bg-slate-800" : "bg-red-50/50 dark:bg-red-900/10 opacity-75",
                                  "hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                                )}
                                onClick={() => {
                                  if(disponible) setForm(f => ({...f, ambienteId: a.id}));
                                }}
                              >
                                <td className="px-3 py-2 font-medium dark:text-slate-200">
                                  {a.codigo}
                                  {form.ambienteId === a.id && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500"></span>}
                                </td>
                                <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-center">{a.capacidad ?? '-'}</td>
                                <td className="px-3 py-2">
                                  {disponible 
                                    ? <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> {mensaje}</span> 
                                    : <span className="text-red-500 dark:text-red-400 flex items-center gap-1"><X className="w-3 h-3"/> {mensaje}</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* LABORATORIO */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Ambientes para LABORATORIO:</h4>
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden text-xs max-h-60 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Ambiente</th>
                            <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400 text-center">Capacidad</th>
                            <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Disponible</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {labs.map(a => {
                            const { disponible, mensaje } = getDisponibilidadAmbiente(a.id);
                            return (
                              <tr 
                                key={a.id} 
                                className={cn(
                                  disponible ? "bg-white dark:bg-slate-800" : "bg-red-50/50 dark:bg-red-900/10 opacity-75",
                                  "hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                                )}
                                onClick={() => {
                                  if(disponible) setForm(f => ({...f, ambienteId: a.id}));
                                }}
                              >
                                <td className="px-3 py-2 font-medium dark:text-slate-200">
                                  {a.codigo}
                                  {form.ambienteId === a.id && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500"></span>}
                                </td>
                                <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-center">{a.capacidad ?? '-'}</td>
                                <td className="px-3 py-2">
                                  {disponible 
                                    ? <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> {mensaje}</span> 
                                    : <span className="text-red-500 dark:text-red-400 flex items-center gap-1"><X className="w-3 h-3"/> {mensaje}</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <FormModalFooter
            onCancel={() => {
              setCreateOpen(false);
              setEditingId(null);
              setForm({
                cursoId: '', docenteId: '', ambienteId: '', grupoId: '', diaSemana: DiaSemana.LUNES, horaInicio: '08:00', horaFin: '10:00',
              });
            }}
            onSubmit={handleCreate}
            saving={savingCreate}
            disabled={
              loadingDocentesCurso || 
              docentes.length === 0 || 
              form.horaInicio < '07:00' || 
              form.horaFin > '21:00'
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
