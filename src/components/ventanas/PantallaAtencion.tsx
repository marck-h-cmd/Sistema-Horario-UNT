'use client';

import * as React from 'react';
import { PanelDocenteActual } from './PanelDocenteActual';
import { PanelLlamarSiguiente } from './PanelLlamarSiguiente';
import { ColaDocentes } from './ColaDocentes';
import { ControlVentana } from './ControlVentana';
import { NotificacionToast } from '@/components/ui/NotificacionToast';
import { cn } from '@/lib/cn';
import {
  BookOpen,
  Building2,
  Users2,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Grid,
  LayoutList,
  AlertTriangle,
  MapPin,
  Check,
  Lock,
} from 'lucide-react';
import { useConfirmacion } from '@/components/ui/ConfirmacionDialogo';

interface Docente {
  id: string;
  nombre: string;
  email: string;
  categoria: string;
  horaLlegada: string;
  horaInicio?: string;
  tiempoTranscurrido?: number;
  prioridad?: 'normal' | 'alta' | 'urgente';
  departamento?: string;
  posicionCola?: number;
}

interface PantallaAtencionProps {
  ventanaId: string;
  className?: string;
  onVolver?: () => void;
}

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

interface TimerData {
  startTime: number;
  pausedTime: number;
  isPaused: boolean;
  totalPausedTime: number;
}

const getTimerKey = (ventanaId: string) => `ventana-timer:${ventanaId}`;

const loadTimerData = (ventanaId: string): TimerData | null => {
  try {
    const data = localStorage.getItem(getTimerKey(ventanaId));
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const saveTimerData = (ventanaId: string, data: TimerData) => {
  try {
    localStorage.setItem(getTimerKey(ventanaId), JSON.stringify(data));
  } catch {
    console.error('Error saving timer data');
  }
};

const clearTimerData = (ventanaId: string) => {
  try {
    localStorage.removeItem(getTimerKey(ventanaId));
    localStorage.removeItem(`last-llamado-slot:${ventanaId}`);
  } catch {
    console.error('Error clearing timer data');
  }
};

export function PantallaAtencion({ ventanaId, className, onVolver }: PantallaAtencionProps) {
  const { confirmar } = useConfirmacion();
  // Estados de carga y ventana
  const [loading, setLoading] = React.useState(true);
  const [ventana, setVentana] = React.useState<any>(null);
  const [estadoVentana, setEstadoVentana] = React.useState<'inactiva' | 'activa' | 'pausada' | 'finalizada'>('inactiva');
  const [colaDocentes, setColaDocentes] = React.useState<any[]>([]);
  const [notificaciones, setNotificaciones] = React.useState<any[]>([]);
  const [tiempoAtencion, setTiempoAtencion] = React.useState(0);
  const [tiempoVentana, setTiempoVentana] = React.useState(0);
  const [timerData, setTimerData] = React.useState<TimerData | null>(null);
  const [todosLosHorarios, setTodosLosHorarios] = React.useState<any[]>([]);
  const [lastLlamadoSlot, setLastLlamadoSlot] = React.useState<number | null>(null);

  // Docente en atención y su carga/horarios
  const [docenteActual, setDocenteActual] = React.useState<any>(null);
  const [atencionActualId, setAtencionActualId] = React.useState<string | null>(null);
  const [cursosCarga, setCursosCarga] = React.useState<any[]>([]);
  const [horariosBorrador, setHorariosBorrador] = React.useState<any[]>([]);
  const [allHorariosDocente, setAllHorariosDocente] = React.useState<any[]>([]);
  const [disponibilidadDocente, setDisponibilidadDocente] = React.useState<any[]>([]);
  const [horariosAmbiente, setHorariosAmbiente] = React.useState<any[]>([]);

  // Opciones para combos
  const [ambientes, setAmbientes] = React.useState<any[]>([]);
  const [grupos, setGrupos] = React.useState<any[]>([]);

  // Tipo de vista del Workspace: 'calendario' (grilla) o 'tarjetas' (lista)
  const [vistaWorkspace, setVistaWorkspace] = React.useState<'calendario' | 'tarjetas'>('calendario');

  // Estado del formulario de programación
  const [formState, setFormState] = React.useState({
    id: '',
    cursoId: '',
    grupoId: '',
    ambienteId: '',
    diaSemana: 'LUNES',
    horaInicio: '08:00',
    horaFin: '10:00',
  });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Estados para arrastre en el horario
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<{ dia: string; horaIndex: number } | null>(null);
  const [dragEnd, setDragEnd] = React.useState<{ dia: string; horaIndex: number } | null>(null);
  const [selectedSlotRange, setSelectedSlotRange] = React.useState<{ dia: string; startHour: number; endHour: number } | null>(null);

  const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const HORAS_NUM = Array.from({ length: 14 }, (_, i) => i + 7); // 7 to 20

  const HORAS = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
  ];

  const DIA_LABEL: Record<string, string> = {
    LUNES: 'LUNES',
    MARTES: 'MARTES',
    MIERCOLES: 'MIÉRCOLES',
    JUEVES: 'JUEVES',
    VIERNES: 'VIERNES',
    SABADO: 'SÁBADO',
  };

  // Fetch inicial
  const cargarDatosVentana = React.useCallback(async () => {
    try {
      // 1. Obtener ventana
      const resVentana = await fetch(`/api/ventanas-atencion/${ventanaId}`);
      if (!resVentana.ok) throw new Error('Error al cargar la ventana');
      const dataVentana = await resVentana.json();
      setVentana(dataVentana.data);

      // Mapear estado y cargar timer
      const est = dataVentana.data.estado;
      let nuevoEstado: 'inactiva' | 'activa' | 'pausada' | 'finalizada';
      if (est === 'PROGRAMADA') nuevoEstado = 'inactiva';
      else if (est === 'ABIERTA' || est === 'EN_CURSO') nuevoEstado = 'activa';
      else if (est === 'CERRADA') nuevoEstado = 'finalizada';
      else if (est === 'CANCELADA') nuevoEstado = 'finalizada';
      else nuevoEstado = 'inactiva';

      setEstadoVentana(nuevoEstado);

      // Cargar timer data
      const savedTimer = loadTimerData(ventanaId);
      if (savedTimer) {
        setTimerData(savedTimer);
        
        // Calculate elapsed time
        if (savedTimer.isPaused) {
          setTiempoVentana(savedTimer.pausedTime);
          if (nuevoEstado !== 'finalizada') {
            setEstadoVentana('pausada');
          }
        } else {
          const elapsed = Math.floor((Date.now() - savedTimer.startTime - savedTimer.totalPausedTime) / 1000);
          setTiempoVentana(elapsed > 0 ? elapsed : 0);
        }
      } else if (nuevoEstado === 'activa') {
        // Si la ventana ya está activa pero no hay temporizador guardado localmente
        // (ej. se inició desde el panel general o se cambió de navegador/ventana),
        // lo inicializamos en base a updatedAt de la ventana (que registra cuándo se abrió).
        const startMs = new Date(dataVentana.data.updatedAt).getTime();
        const newTimerData: TimerData = {
          startTime: startMs,
          pausedTime: 0,
          isPaused: false,
          totalPausedTime: 0,
        };
        setTimerData(newTimerData);
        saveTimerData(ventanaId, newTimerData);
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        setTiempoVentana(elapsed > 0 ? elapsed : 0);
      } else if (nuevoEstado === 'finalizada') {
        clearTimerData(ventanaId);
      }

      // Cargar todos los horarios del periodo para la verificación de disponibilidad
      if (dataVentana.data.periodoId) {
        const resTodosHor = await fetch(`/api/horarios?periodoId=${dataVentana.data.periodoId}&limit=2000`);
        if (resTodosHor.ok) {
          const dataTodos = await resTodosHor.json();
          setTodosLosHorarios(dataTodos.data || []);
        }
      }

      // 2. Obtener cola
      const resCola = await fetch(`/api/ventanas-atencion/${ventanaId}/cola`);
      if (resCola.ok) {
        const dataCola = await resCola.json();
        setColaDocentes(dataCola.data.cola || []);

        // Buscar si hay alguien en atención
        const enAtencion = dataCola.data.cola.find((a: any) => a.estado === 'EN_ATENCION');
        if (enAtencion) {
          setDocenteActual(enAtencion.docente);
          setAtencionActualId(enAtencion.id);

          if (enAtencion.horaInicio) {
            const diff = Math.floor((new Date().getTime() - new Date(enAtencion.horaInicio).getTime()) / 1000);
            setTiempoAtencion(diff > 0 ? diff : 0);
          }
        } else {
          setDocenteActual(null);
          setAtencionActualId(null);
          setTiempoAtencion(0);
        }
      }

      // 3. Obtener notificaciones de ausencias justificadas
      const resNotifs = await fetch('/api/notificaciones?tipo=SISTEMA&limit=50');
      if (resNotifs.ok) {
        const dataNotifs = await resNotifs.json();
        setNotificaciones(dataNotifs.data || []);
      }

      // 4. Obtener ambientes activos
      const resAmbientes = await fetch('/api/ambientes?limit=100&activo=true');
      if (resAmbientes.ok) {
        const dataAmbientes = await resAmbientes.json();
        setAmbientes(dataAmbientes.data || []);
      }
    } catch (err) {
      console.error(err);
      NotificacionToast.error('No se pudieron cargar los datos de la ventana');
    } finally {
      setLoading(false);
    }
  }, [ventanaId]);

  // Cargar cursos del docente en atención
  React.useEffect(() => {
    if (!docenteActual) {
      setCursosCarga([]);
      setHorariosBorrador([]);
      setAllHorariosDocente([]);
      setDisponibilidadDocente([]);
      return;
    }

    const cargarCargaYHorarios = async () => {
      try {
        const resCursos = await fetch(`/api/carga-academica?docenteId=${docenteActual.id}`);
        if (resCursos.ok) {
          const dataCursos = await resCursos.json();
          setCursosCarga(dataCursos.data || []);
        }

        const resHorarios = await fetch(
          `/api/horarios?docenteId=${docenteActual.id}&periodoId=${ventana?.periodoId}&limit=100`
        );
        if (resHorarios.ok) {
          const dataHorarios = await resHorarios.json();
          const items = dataHorarios.data || [];
          setAllHorariosDocente(items);
          setHorariosBorrador(items.filter((h: any) => h.estado === 'BORRADOR'));
        }

        // Fetch docente availability
        const resDisp = await fetch(`/api/docentes/${docenteActual.id}/disponibilidad`);
        if (resDisp.ok) {
          const dataDisp = await resDisp.json();
          setDisponibilidadDocente(dataDisp.data || []);
        } else {
          setDisponibilidadDocente([]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    cargarCargaYHorarios();
  }, [docenteActual, ventana?.periodoId]);

  // Cargar horarios del ambiente seleccionado
  React.useEffect(() => {
    if (!formState.ambienteId || !ventana?.periodoId) {
      setHorariosAmbiente([]);
      return;
    }

    const cargarHorariosAmbiente = async () => {
      try {
        const res = await fetch(
          `/api/horarios?ambienteId=${formState.ambienteId}&periodoId=${ventana.periodoId}&limit=100`
        );
        if (res.ok) {
          const json = await res.json();
          setHorariosAmbiente(json.data || []);
        }
      } catch (e) {
        console.error(e);
      }
    };

    cargarHorariosAmbiente();
  }, [formState.ambienteId, ventana?.periodoId]);

  // Cargar grupos cuando cambia el curso
  React.useEffect(() => {
    if (!formState.cursoId) {
      setGrupos([]);
      return;
    }

    const cargarGrupos = async () => {
      try {
        const resGrupos = await fetch(`/api/grupos?cursoId=${formState.cursoId}&activo=true&limit=100`);
        if (resGrupos.ok) {
          const dataGrupos = await resGrupos.json();
          setGrupos(dataGrupos.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    cargarGrupos();
  }, [formState.cursoId]);

  React.useEffect(() => {
    cargarDatosVentana();
  }, [cargarDatosVentana]);

  React.useEffect(() => {
    const saved = localStorage.getItem(`last-llamado-slot:${ventanaId}`);
    if (saved !== null) {
      setLastLlamadoSlot(parseInt(saved, 10));
    } else {
      setLastLlamadoSlot(null);
    }
  }, [ventanaId]);

  // --- Lógica de arrastre de carga lectiva ---
  const handleMouseDown = (e: React.MouseEvent, dia: string, horaIndex: number) => {
    if (!formState.cursoId || !formState.grupoId) {
      NotificacionToast.error('Seleccione curso y grupo antes de arrastrar en el horario.');
      return;
    }
    e.preventDefault(); // Prevent text selection / native drag
    setIsDragging(true);
    setDragStart({ dia, horaIndex });
    setDragEnd({ dia, horaIndex });
    setSelectedSlotRange(null);

    // Set time range in formState instantly
    const hStartStr = horaIndex.toString().padStart(2, '0') + ':00';
    const hEndStr = (horaIndex + 1).toString().padStart(2, '0') + ':00';
    setFormState((prev) => ({
      ...prev,
      diaSemana: dia,
      horaInicio: hStartStr,
      horaFin: hEndStr,
    }));
  };

  const handleMouseEnterCell = (dia: string, horaIndex: number) => {
    if (!isDragging || !dragStart) return;
    setDragEnd({ dia: dragStart.dia, horaIndex });

    // Update time range in formState in real-time as user drags
    const startIdx = Math.min(dragStart.horaIndex, horaIndex);
    const endIdx = Math.max(dragStart.horaIndex, horaIndex);
    const hStartStr = startIdx.toString().padStart(2, '0') + ':00';
    const hEndStr = (endIdx + 1).toString().padStart(2, '0') + ':00';
    setFormState((prev) => ({
      ...prev,
      diaSemana: dragStart.dia,
      horaInicio: hStartStr,
      horaFin: hEndStr,
    }));
  };

  const crearBloqueHorario = async (dia: string, startHour: number, endHour: number) => {
    if (!formState.cursoId || !formState.grupoId || !formState.ambienteId) {
      NotificacionToast.error('Por favor seleccione asignatura, grupo y ambiente.');
      return;
    }

    // Validar disponibilidad del docente
    if (disponibilidadDocente.length > 0) {
      for (let h = startHour; h < endHour; h++) {
        const slotDisp = disponibilidadDocente.some((d: any) => {
          if (d.diaSemana !== dia) return false;
          const hInicio = parseInt(d.horaInicio.split(':')[0], 10);
          const hFin = parseInt(d.horaFin.split(':')[0], 10);
          return h >= hInicio && h < hFin;
        });
        if (!slotDisp) {
          NotificacionToast.error('El docente no está disponible en este horario.');
          return;
        }
      }
    }

    // Validar cruce de docente
    const cruceDoc = allHorariosDocente.find((h: any) => {
      if (formState.id && h.id === formState.id) return false;
      if (h.diaSemana !== dia) return false;
      if (h.estado === 'CANCELADO') return false;
      if (!h.horaInicio || !h.horaFin) return false;
      const hStart = parseInt(h.horaInicio.split(':')[0], 10);
      const hEnd = parseInt(h.horaFin.split(':')[0], 10);
      return Math.max(hStart, startHour) < Math.min(hEnd, endHour);
    });

    // Validar cruce de grupo
    const cruceGrupo = todosLosHorarios.find((h: any) => {
      if (formState.id && h.id === formState.id) return false;
      if (h.diaSemana !== dia) return false;
      if (h.estado === 'CANCELADO') return false;
      if (!h.cursoDocenteGrupo || h.cursoDocenteGrupo.id !== formState.grupoId) return false;
      if (!h.horaInicio || !h.horaFin) return false;
      const hStart = parseInt(h.horaInicio.split(':')[0], 10);
      const hEnd = parseInt(h.horaFin.split(':')[0], 10);
      return Math.max(hStart, startHour) < Math.min(hEnd, endHour);
    });

    // Validar cruce de ambiente
    const cruceAmb = todosLosHorarios.find((h: any) => {
      if (formState.id && h.id === formState.id) return false;
      if (h.diaSemana !== dia) return false;
      if (h.estado === 'CANCELADO') return false;
      if (!h.ambiente || h.ambiente.id !== formState.ambienteId) return false;
      if (!h.horaInicio || !h.horaFin) return false;
      const hInicio = parseInt(h.horaInicio.split(':')[0], 10);
      const hFin = parseInt(h.horaFin.split(':')[0], 10);
      return Math.max(hInicio, startHour) < Math.min(hFin, endHour);
    });

    // Validar límite de horas del curso
    const cursoCarga = cursosCarga.find((item) => (item.planEstudioCurso?.curso?.id || item.curso?.id) === formState.cursoId);
    const horasAsignadas = cursoCarga?.horasAsignadas || 0;
    const horasProgramadas = allHorariosDocente
      .filter((h) => (h.curso?.id === formState.cursoId || h.cursoId === formState.cursoId) && h.estado !== 'CANCELADO' && h.horaInicio && h.horaFin && (!formState.id || h.id !== formState.id))
      .reduce((sum, h) => {
        const hInicio = parseInt(h.horaInicio.split(':')[0], 10);
        const hFin = parseInt(h.horaFin.split(':')[0], 10);
        return sum + (hFin - hInicio);
      }, 0);
    const duracion = endHour - startHour;

    let isValid = true;
    let errorMsg = '';
    if (cruceDoc) {
      isValid = false;
      errorMsg = `El docente ya tiene una clase programada en este horario: ${cruceDoc.curso?.codigo || ''} (${cruceDoc.horaInicio} - ${cruceDoc.horaFin}).`;
    } else if (cruceGrupo) {
      isValid = false;
      errorMsg = `El grupo ya tiene una clase programada en este horario por ${cruceGrupo.curso?.codigo || ''} (${cruceGrupo.horaInicio} - ${cruceGrupo.horaFin}).`;
    } else if (cruceAmb) {
      isValid = false;
      errorMsg = `El ambiente ya está ocupado en este horario por ${cruceAmb.curso?.codigo || ''} (${cruceAmb.horaInicio} - ${cruceAmb.horaFin}).`;
    } else if (horasProgramadas + duracion > horasAsignadas) {
      isValid = false;
      errorMsg = `Se superaría el límite de horas asignadas (${horasProgramadas + duracion}h de ${horasAsignadas}h).`;
    }

    if (isValid) {
      setIsSubmitting(true);
      const hStartStr = startHour.toString().padStart(2, '0') + ':00';
      const hEndStr = endHour.toString().padStart(2, '0') + ':00';

      try {
        const payload: any = {
          periodoId: ventana.periodoId,
          cursoId: formState.cursoId,
          docenteId: docenteActual.id,
          ambienteId: formState.ambienteId,
          diaSemana: dia,
          horaInicio: hStartStr,
          horaFin: hEndStr,
        };
        if (formState.grupoId) payload.grupoId = formState.grupoId;

        const res = await fetch('/api/horarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          NotificacionToast.exito('Bloque horario programado correctamente.');
          setSelectedSlotRange(null);
          setFormState((prev) => ({ ...prev, ambienteId: '' }));

          // reload docente schedules
          const resHorarios = await fetch(
            `/api/horarios?docenteId=${docenteActual.id}&periodoId=${ventana.periodoId}&limit=100`
          );
          if (resHorarios.ok) {
            const dataHorarios = await resHorarios.json();
            const items = dataHorarios.data || [];
            setAllHorariosDocente(items);
            setHorariosBorrador(items.filter((h) => h.estado === 'BORRADOR'));
          }

          // reload all schedules list
          const resTodosHor = await fetch(`/api/horarios?periodoId=${ventana.periodoId}&limit=2000`);
          if (resTodosHor.ok) {
            const dataTodos = await resTodosHor.json();
            setTodosLosHorarios(dataTodos.data || []);
          }
        } else {
          NotificacionToast.error(data.error?.message || data.message || 'Error al validar o registrar horario');
        }
      } catch (err) {
        NotificacionToast.error('Error de red al registrar horario.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      NotificacionToast.error(errorMsg);
    }
  };

  React.useEffect(() => {
    const handleGlobalMouseUp = async () => {
      if (isDragging) {
        if (dragStart && dragEnd) {
          const startIdx = Math.min(dragStart.horaIndex, dragEnd.horaIndex);
          const endIdx = Math.max(dragStart.horaIndex, dragEnd.horaIndex);

          const startHour = startIdx;
          const endHour = endIdx + 1;
          const dia = dragStart.dia;

          // Validar disponibilidad del docente
          let isDispOk = true;
          if (disponibilidadDocente.length > 0) {
            for (let h = startHour; h < endHour; h++) {
              const slotDisp = disponibilidadDocente.some((d: any) => {
                if (d.diaSemana !== dia) return false;
                const hInicio = parseInt(d.horaInicio.split(':')[0], 10);
                const hFin = parseInt(d.horaFin.split(':')[0], 10);
                return h >= hInicio && h < hFin;
              });
              if (!slotDisp) {
                isDispOk = false;
                break;
              }
            }
          }

          // Validar cruce de docente
          const cruceDoc = allHorariosDocente.find((h: any) => {
            if (formState.id && h.id === formState.id) return false;
            if (h.diaSemana !== dia) return false;
            if (h.estado === 'CANCELADO') return false;
            if (!h.horaInicio || !h.horaFin) return false;
            const hStart = parseInt(h.horaInicio.split(':')[0], 10);
            const hEnd = parseInt(h.horaFin.split(':')[0], 10);
            return Math.max(hStart, startHour) < Math.min(hEnd, endHour);
          });

          // Validar cruce de grupo
          const cruceGrupo = todosLosHorarios.find((h: any) => {
            if (formState.id && h.id === formState.id) return false;
            if (h.diaSemana !== dia) return false;
            if (h.estado === 'CANCELADO') return false;
            if (!h.cursoDocenteGrupo || h.cursoDocenteGrupo.id !== formState.grupoId) return false;
            if (!h.horaInicio || !h.horaFin) return false;
            const hStart = parseInt(h.horaInicio.split(':')[0], 10);
            const hEnd = parseInt(h.horaFin.split(':')[0], 10);
            return Math.max(hStart, startHour) < Math.min(hEnd, endHour);
          });

          // Validar cruce de ambiente
          const cruceAmb = formState.ambienteId ? todosLosHorarios.find((h: any) => {
            if (formState.id && h.id === formState.id) return false;
            if (h.diaSemana !== dia) return false;
            if (h.estado === 'CANCELADO') return false;
            if (!h.ambiente || h.ambiente.id !== formState.ambienteId) return false;
            if (!h.horaInicio || !h.horaFin) return false;
            const hStart = parseInt(h.horaInicio.split(':')[0], 10);
            const hEnd = parseInt(h.horaFin.split(':')[0], 10);
            return Math.max(hStart, startHour) < Math.min(hEnd, endHour);
          }) : null;

          // Validar límite de horas del curso
          const cursoCarga = cursosCarga.find((item) => (item.planEstudioCurso?.curso?.id || item.curso?.id) === formState.cursoId);
          const horasAsignadas = cursoCarga?.horasAsignadas || 0;
          const horasProgramadas = allHorariosDocente
            .filter((h) => (h.curso?.id === formState.cursoId || h.cursoId === formState.cursoId) && h.estado !== 'CANCELADO' && h.horaInicio && h.horaFin && (!formState.id || h.id !== formState.id))
            .reduce((sum, h) => {
              const hInicio = parseInt(h.horaInicio.split(':')[0], 10);
              const hFin = parseInt(h.horaFin.split(':')[0], 10);
              return sum + (hFin - hInicio);
            }, 0);
          const duracion = endHour - startHour;

          let errorMsg = '';
          if (!isDispOk) {
            errorMsg = 'El docente no está disponible en este horario.';
          } else if (cruceDoc) {
            errorMsg = `El docente ya tiene una clase programada en este horario: ${cruceDoc.curso?.codigo || ''} (${cruceDoc.horaInicio} - ${cruceDoc.horaFin}).`;
          } else if (cruceGrupo) {
            errorMsg = `El grupo ya tiene una clase programada en este horario por ${cruceGrupo.curso?.codigo || ''} (${cruceGrupo.horaInicio} - ${cruceGrupo.horaFin}).`;
          } else if (cruceAmb) {
            errorMsg = `El ambiente ya está ocupado en este horario por ${cruceAmb.curso?.codigo || ''} (${cruceAmb.horaInicio} - ${cruceAmb.horaFin}).`;
          } else if (horasProgramadas + duracion > horasAsignadas) {
            errorMsg = `Se superaría el límite de horas asignadas (${horasProgramadas + duracion}h de ${horasAsignadas}h).`;
          }

          if (errorMsg) {
            NotificacionToast.error(errorMsg);
            setSelectedSlotRange(null);
          } else {
            setSelectedSlotRange({ dia, startHour, endHour });
            setFormState((prev) => ({
              ...prev,
              diaSemana: dia,
              horaInicio: startHour.toString().padStart(2, '0') + ':00',
              horaFin: endHour.toString().padStart(2, '0') + ':00',
            }));

            if (formState.ambienteId) {
              await crearBloqueHorario(dia, startHour, endHour);
            } else {
              NotificacionToast.exito(`Horario seleccionado: ${dia} ${startHour}:00 - ${endHour}:00. Elija un ambiente para programar.`);
            }
          }
        }
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, dragEnd, formState, allHorariosDocente, todosLosHorarios, cursosCarga, docenteActual, ventana, disponibilidadDocente]);

  // Temporizadores
  React.useEffect(() => {
    if (!docenteActual || estadoVentana !== 'activa') return;
    const intervalo = setInterval(() => setTiempoAtencion((prev) => prev + 1), 1000);
    return () => clearInterval(intervalo);
  }, [docenteActual, estadoVentana]);

  React.useEffect(() => {
    if (estadoVentana !== 'activa' || !timerData) return;
    
    const intervalo = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerData.startTime - timerData.totalPausedTime) / 1000);
      setTiempoVentana(elapsed > 0 ? elapsed : 0);
    }, 1000);
    
    return () => clearInterval(intervalo);
  }, [estadoVentana, timerData]);

  // ── Acciones de ventana ──────────────────────────────────────────────────
  const handleIniciarVentana = async () => {
    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'abrir' }),
      });
      if (res.ok) {
        const newTimerData: TimerData = {
          startTime: Date.now(),
          pausedTime: 0,
          isPaused: false,
          totalPausedTime: 0,
        };
        setTimerData(newTimerData);
        saveTimerData(ventanaId, newTimerData);
        setTiempoVentana(0);
        setEstadoVentana('activa');
        NotificacionToast.exito('Ventana de atención iniciada correctamente');
        cargarDatosVentana();
      } else {
        const err = await res.json();
        throw new Error(err.message || 'Error al iniciar la ventana');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  };

  const handlePausarVentana = () => {
    if (!timerData) return;
    
    const newTimerData: TimerData = {
      ...timerData,
      isPaused: true,
      pausedTime: tiempoVentana,
    };
    setTimerData(newTimerData);
    saveTimerData(ventanaId, newTimerData);
    setEstadoVentana('pausada');
    NotificacionToast.info('Ventana pausada');
  };

  const handleReanudarVentana = () => {
    if (!timerData) return;
    
    const newTimerData: TimerData = {
      ...timerData,
      isPaused: false,
      // When resuming, we adjust the startTime forward by the paused duration
      // This way elapsed time calculation remains correct
      startTime: Date.now() - timerData.pausedTime * 1000 - timerData.totalPausedTime,
    };
    setTimerData(newTimerData);
    saveTimerData(ventanaId, newTimerData);
    setEstadoVentana('activa');
    NotificacionToast.info('Ventana reanudada');
  };

  const handleFinalizarVentana = async () => {
    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'cerrar' }),
      });
      if (res.ok) {
        clearTimerData(ventanaId);
        setTimerData(null);
        setEstadoVentana('finalizada');
        NotificacionToast.exito('Ventana finalizada');
        cargarDatosVentana();
      } else {
        throw new Error('Error al finalizar ventana');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  };

  const handleSaltarTurno = async () => {
    if (!timerData) return;
    const currentSlot = Math.floor(tiempoVentana / 900);
    const nextSlotStart = (currentSlot + 1) * 900;
    const deltaSeconds = nextSlotStart - tiempoVentana;

    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}/saltar-turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deltaSeconds }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al saltar el turno en el servidor');
      }

      const newTimerData = {
        ...timerData,
        startTime: timerData.startTime - (deltaSeconds * 1000),
      };
      setTimerData(newTimerData);
      saveTimerData(ventanaId, newTimerData);
      setTiempoVentana(nextSlotStart);
      NotificacionToast.exito(`Turno saltado al siguiente bloque de 15 minutos.`);
      cargarDatosVentana();
    } catch (err: any) {
      NotificacionToast.error(err.message || 'No se pudo saltar el turno en el servidor');
    }
  };

  const handleLlamarDocente = async () => {
    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}/llamar-siguiente`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        if (data.data.ventanaCerrada) {
          NotificacionToast.info(data.data.mensaje);
          setEstadoVentana('finalizada');
        } else {
          NotificacionToast.exito(`Docente llamado: ${data.data.atencion.docente.usuario.nombre}`);
          // Registrar el slot en el que se llamó a este docente (sin reiniciar el temporizador general)
          const currentSlot = Math.floor(tiempoVentana / 900);
          setLastLlamadoSlot(currentSlot);
          localStorage.setItem(`last-llamado-slot:${ventanaId}`, currentSlot.toString());
        }
        cargarDatosVentana();
      } else {
        throw new Error(data.message || 'Error al llamar siguiente docente');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  };

  const handleCancelarAtencion = React.useCallback(async (atencionIdToCancel?: any) => {
    const idToCancel = typeof atencionIdToCancel === 'string' ? atencionIdToCancel : atencionActualId;
    if (!idToCancel) return;
    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}/marcar-ausente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atencionId: idToCancel }),
      });
      if (res.ok) {
        NotificacionToast.advertencia('Atención marcada como AUSENTE');
        if (idToCancel === atencionActualId) {
          setDocenteActual(null);
          setAtencionActualId(null);
          setTiempoAtencion(0);
        }
        cargarDatosVentana();
      } else {
        throw new Error('Error al marcar docente como ausente');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  }, [atencionActualId, ventanaId, cargarDatosVentana]);

  const handleFinalizarAtencion = async () => {
    if (!atencionActualId) return;
    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}/finalizar-atencion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atencionId: atencionActualId }),
      });
      if (res.ok) {
        NotificacionToast.exito('Atención de docente finalizada correctamente');
        setDocenteActual(null);
        setAtencionActualId(null);
        setTiempoAtencion(0);
        cargarDatosVentana();
      } else {
        throw new Error('Error al finalizar atención');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  };

  // Cancelar automáticamente la atención si transcurren los 15 minutos de la ranura actual o anteriores
  React.useEffect(() => {
    if (estadoVentana !== 'activa') return;

    // Buscar cualquier atencion cuyo slot de 15 minutos haya expirado pero siga en Esperando o En Atención
    const expiredAtencion = colaDocentes.find((a: any) => 
      tiempoVentana >= a.posicion * 900 && 
      (a.estado === 'ESPERANDO' || a.estado === 'EN_ATENCION')
    );

    if (expiredAtencion) {
      NotificacionToast.advertencia(`El tiempo de atención para ${expiredAtencion.docente.usuario.nombre} ha finalizado.`);
      handleCancelarAtencion(expiredAtencion.id);
    }
  }, [tiempoVentana, colaDocentes, estadoVentana, handleCancelarAtencion]);

  // ── CRUD de bloques horarios ──────────────────────────────────────────────
  const handleGuardarBloque = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const { id, cursoId, grupoId, ambienteId, diaSemana, horaInicio, horaFin } = formState;

    if (!cursoId || !ambienteId || !diaSemana || !horaInicio || !horaFin) {
      setFormError('Por favor complete todos los campos obligatorios.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload: any = {
        periodoId: ventana.periodoId,
        cursoId,
        docenteId: docenteActual.id,
        ambienteId,
        diaSemana,
        horaInicio,
        horaFin,
      };
      if (grupoId) payload.grupoId = grupoId;

      const res = isEditing && id
        ? await fetch(`/api/horarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/horarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await res.json();

      if (res.ok) {
        NotificacionToast.exito(isEditing ? 'Bloque horario actualizado' : 'Bloque horario registrado exitosamente');
        setFormState({ id: '', cursoId: '', grupoId: '', ambienteId: '', diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '10:00' });
        setIsEditing(false);

        const resHorarios = await fetch(
          `/api/horarios?docenteId=${docenteActual.id}&periodoId=${ventana.periodoId}&limit=100`
        );
        if (resHorarios.ok) {
          const dataHorarios = await resHorarios.json();
          const items = dataHorarios.data || [];
          setAllHorariosDocente(items);
          setHorariosBorrador(items.filter((h: any) => h.estado === 'BORRADOR'));
        }

        // reload all schedules list
        const resTodosHor = await fetch(`/api/horarios?periodoId=${ventana.periodoId}&limit=2000`);
        if (resTodosHor.ok) {
          const dataTodos = await resTodosHor.json();
          setTodosLosHorarios(dataTodos.data || []);
        }
      } else {
        setFormError(data.error?.message || data.message || 'Error al validar o registrar horario');
      }
    } catch (err: any) {
      setFormError('Error de red al registrar horario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditarBloque = (bloque: any) => {
    setFormState({
      id: bloque.id,
      cursoId: bloque.curso?.id || '',
      grupoId: bloque.cursoDocenteGrupoId || bloque.grupo?.id || '',
      ambienteId: bloque.ambiente?.id || bloque.ambienteId || '',
      diaSemana: bloque.diaSemana,
      horaInicio: bloque.horaInicio,
      horaFin: bloque.horaFin,
    });
    setIsEditing(true);
    setFormError(null);
  };

  const handleEliminarBloque = async (id: string) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar Bloque Horario',
      mensaje: '¿Está seguro de eliminar este bloque horario del borrador?',
      tipo: 'danger',
      textoConfirmar: 'Eliminar',
      textoCancelar: 'Cancelar',
    });
    if (!confirmado) return;
    try {
      const res = await fetch(`/api/horarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        NotificacionToast.exito('Bloque horario eliminado');
        setHorariosBorrador((prev) => prev.filter((h) => h.id !== id));
        setAllHorariosDocente((prev) => prev.filter((h) => h.id !== id));
        setTodosLosHorarios((prev) => prev.filter((h) => h.id !== id));
        if (formState.id === id) {
          setFormState({ id: '', cursoId: '', grupoId: '', ambienteId: '', diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '10:00' });
          setIsEditing(false);
        }
      } else {
        throw new Error('No se pudo eliminar el bloque horario');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  };

  const handleConfirmarBloque = async (id: string) => {
    const confirmado = await confirmar({
      titulo: 'Confirmar Bloque Horario',
      mensaje: '¿Está seguro de confirmar este bloque horario?',
      tipo: 'warning',
      textoConfirmar: 'Confirmar',
      textoCancelar: 'Cancelar',
    });
    if (!confirmado) return;
    try {
      const res = await fetch(`/api/horarios/${id}/confirmar`, { method: 'POST' });
      if (res.ok) {
        NotificacionToast.exito('Bloque horario confirmado');
        if (docenteActual && ventana) {
          const resHorarios = await fetch(
            `/api/horarios?docenteId=${docenteActual.id}&periodoId=${ventana.periodoId}&limit=100`
          );
          if (resHorarios.ok) {
            const dataHorarios = await resHorarios.json();
            const items = dataHorarios.data || [];
            setAllHorariosDocente(items);
            setHorariosBorrador(items.filter((h: any) => h.estado === 'BORRADOR'));
          }
        }
      } else {
        const err = await res.json();
        throw new Error(err.message || 'No se pudo confirmar el bloque horario');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  };

  const handleConfirmarSeleccion = async () => {
    if (!docenteActual || !ventana) return;
    try {
      const res = await fetch(`/api/ventanas-atencion/${ventanaId}/confirmar-horarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docenteId: docenteActual.id, periodoId: ventana.periodoId }),
      });
      const data = await res.json();
      if (res.ok) {
        NotificacionToast.exito('Horarios confirmados y notificaciones enviadas correctamente');
        await handleFinalizarAtencion();
      } else {
        throw new Error(data.message || 'Error al confirmar selección');
      }
    } catch (err: any) {
      NotificacionToast.error(err.message);
    }
  };

  // ── Validador Dinámico En Vivo ────────────────────────────────────────────
  const validacionEnVivo = React.useMemo(() => {
    const { id, cursoId, ambienteId, diaSemana, horaInicio, horaFin } = formState;

    if (!cursoId || !ambienteId || !diaSemana || !horaInicio || !horaFin) {
      return {
        listo: false,
        docenteOk: true,
        ambienteOk: true,
        horasOk: true,
        rangoOk: true,
        mensajeDocente: 'Complete los campos para validar la disponibilidad del docente.',
        mensajeAmbiente: 'Complete los campos para validar la disponibilidad del aula.',
        mensajeHoras: 'Seleccione un curso para verificar las horas asignadas.',
        mensajeRango: 'Defina un rango de horas válido.',
      };
    }

    const startHour = parseInt(horaInicio.split(':')[0], 10);
    const endHour = parseInt(horaFin.split(':')[0], 10);
    const duracion = endHour - startHour;

    // 1. Rango
    const rangoOk = duracion > 0 && startHour >= 7 && endHour <= 21;
    const mensajeRango = rangoOk
      ? `Horario válido (${duracion} horas)`
      : 'La hora de fin debe ser posterior a la de inicio (rango permitido de 7am a 9pm)';

    // 2. Cruce de Docente
    const cruceDoc = allHorariosDocente.find((h: any) => {
      if (id && h.id === id) return false;
      if (h.diaSemana !== diaSemana) return false;
      if (h.estado === 'CANCELADO') return false;
      if (!h.horaInicio || !h.horaFin) return false;
      const hInicio = parseInt(h.horaInicio.split(':')[0], 10);
      const hFin = parseInt(h.horaFin.split(':')[0], 10);
      return Math.max(hInicio, startHour) < Math.min(hFin, endHour);
    });
    const docenteOk = !cruceDoc;
    const mensajeDocente = docenteOk
      ? 'Docente libre en este horario'
      : `El docente ya tiene asignado ${cruceDoc.curso?.codigo || 'otro curso'} (${cruceDoc.horaInicio} - ${cruceDoc.horaFin})`;

    // 3. Cruce de Ambiente
    const cruceAmb = horariosAmbiente.find((h: any) => {
      if (id && h.id === id) return false;
      if (h.diaSemana !== diaSemana) return false;
      if (h.estado === 'CANCELADO') return false;
      if (!h.horaInicio || !h.horaFin) return false;
      const hInicio = parseInt(h.horaInicio.split(':')[0], 10);
      const hFin = parseInt(h.horaFin.split(':')[0], 10);
      return Math.max(hInicio, startHour) < Math.min(hFin, endHour);
    });
    const ambienteOk = !cruceAmb;
    const mensajeAmbiente = ambienteOk
      ? 'Ambiente libre en este horario'
      : `El ambiente ya está ocupado por ${cruceAmb.curso?.codigo || 'otro curso'} (${cruceAmb.horaInicio} - ${cruceAmb.horaFin})`;

    // 4. Límite de horas del curso
    const cursoCarga = cursosCarga.find((item) => (item.planEstudioCurso?.curso?.id || item.curso?.id) === cursoId);
    const horasAsignadas = cursoCarga?.horasAsignadas || 0;

    const horasProgramadas = allHorariosDocente
      .filter((h: any) => (h.curso?.id === cursoId || h.cursoId === cursoId) && h.estado !== 'CANCELADO' && (!id || h.id !== id) && h.horaInicio && h.horaFin)
      .reduce((sum: number, h: any) => {
        const hInicio = parseInt(h.horaInicio.split(':')[0], 10);
        const hFin = parseInt(h.horaFin.split(':')[0], 10);
        return sum + (hFin - hInicio);
      }, 0);

    const totalConNuevo = horasProgramadas + (rangoOk ? duracion : 0);
    const horasOk = totalConNuevo <= horasAsignadas;
    const mensajeHoras = horasOk
      ? `Carga horaria correcta (${horasProgramadas + duracion}h de ${horasAsignadas}h asignadas)`
      : `Se superaría el límite de horas asignadas (${totalConNuevo}h de ${horasAsignadas}h asignadas)`;

    return {
      listo: true,
      docenteOk,
      ambienteOk,
      horasOk,
      rangoOk,
      mensajeDocente,
      mensajeAmbiente,
      mensajeHoras,
      mensajeRango,
    };
  }, [formState, allHorariosDocente, horariosAmbiente, cursosCarga]);

  const getDisponibilidadAmbiente = (ambienteId: string) => {
    const { diaSemana, horaInicio, horaFin, id: editingId } = formState;
    const parseTime = (t: string) => {
      const parts = t.split(':');
      if (parts.length < 2) return NaN;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };
    const start = parseTime(horaInicio);
    const end = parseTime(horaFin);

    if (isNaN(start) || isNaN(end) || start >= end) return { disponible: false, mensaje: 'Hora inválida' };

    const cruces = todosLosHorarios.filter(h => {
      if (editingId && h.id === editingId) return false;
      if (!h.ambiente || h.ambiente.id !== ambienteId) return false;
      if (h.diaSemana !== diaSemana) return false;
      if (h.estado === 'CANCELADO') return false;
      if (!h.horaInicio || !h.horaFin) return false;
      
      const hStart = parseTime(h.horaInicio);
      const hEnd = parseTime(h.horaFin);
      
      return Math.max(start, hStart) < Math.min(end, hEnd);
    });

    if (cruces.length > 0) {
      return { disponible: false, mensaje: `Ocupado (${cruces[0].curso?.codigo || 'Sin código'})` };
    }
    return { disponible: true, mensaje: 'Sí' };
  };

  // ── Helpers de la grilla ──────────────────────────────────────────────────
  const getHorasDia = (dia: string) => {
    return allHorariosDocente
      .filter((h: any) => h.diaSemana === dia && h.estado !== 'CANCELADO' && h.horaInicio && h.horaFin)
      .reduce((sum: number, h: any) => {
        const inicio = parseInt(h.horaInicio.split(':')[0], 10);
        const fin = parseInt(h.horaFin.split(':')[0], 10);
        return sum + (fin - inicio);
      }, 0);
  };

  const totalHorasSemana = React.useMemo(() => {
    return allHorariosDocente
      .filter((h: any) => h.estado !== 'CANCELADO' && h.horaInicio && h.horaFin)
      .reduce((sum: number, h: any) => {
        const inicio = parseInt(h.horaInicio.split(':')[0], 10);
        const fin = parseInt(h.horaFin.split(':')[0], 10);
        return sum + (fin - inicio);
      }, 0);
  }, [allHorariosDocente]);

  const cursosUnicos = React.useMemo(() => {
    const map = new Map<string, { codigo: string; nombre: string }>();
    allHorariosDocente.forEach((h: any) => {
      if (h.estado !== 'CANCELADO' && h.curso) {
        map.set(h.curso.codigo, { codigo: h.curso.codigo, nombre: h.curso.nombre });
      }
    });
    return Array.from(map.values());
  }, [allHorariosDocente]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // ── Mapeos para subcomponentes ────────────────────────────────────────────
  const siguienteDocente = colaDocentes.find((a: any) => a.estado === 'ESPERANDO');

  const docenteActualAdaptado = docenteActual
    ? {
        id: docenteActual.id,
        nombre: `${docenteActual.usuario.nombre} ${docenteActual.usuario.apellidos}`,
        email: docenteActual.usuario.email,
        categoria: docenteActual.categoria,
        horaInicio: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        tiempoTranscurrido: tiempoAtencion,
      }
    : null;

  const currentSlot = Math.floor(tiempoVentana / 900);
  const docenteEnTurnoCola = colaDocentes.find((a: any) => a.posicion === currentSlot + 1);

  let subEstado: 'esperando_llamado' | 'en_atencion' | 'esperando_turno' | 'inactiva' | 'pausada' | 'finalizada' = 'inactiva';
  if (estadoVentana === 'inactiva') subEstado = 'inactiva';
  else if (estadoVentana === 'pausada') subEstado = 'pausada';
  else if (estadoVentana === 'finalizada') subEstado = 'finalizada';
  else if (docenteActual) {
    subEstado = 'en_atencion';
  } else if (lastLlamadoSlot === currentSlot) {
    subEstado = 'esperando_turno';
  } else {
    subEstado = 'esperando_llamado'; // "llamando a docente en cola"
  }

  const docenteEnTurno = docenteEnTurnoCola
    ? {
        nombre: docenteEnTurnoCola.docente?.usuario ? `${docenteEnTurnoCola.docente.usuario.nombre} ${docenteEnTurnoCola.docente.usuario.apellidos}` : 'Docente Desconocido',
        posicion: docenteEnTurnoCola.posicion,
      }
    : null;

  const siguienteDocenteAdaptado = siguienteDocente
    ? {
        id: siguienteDocente.docente?.id || '',
        nombre: siguienteDocente.docente?.usuario ? `${siguienteDocente.docente.usuario.nombre} ${siguienteDocente.docente.usuario.apellidos}` : 'Docente Desconocido',
        email: siguienteDocente.docente?.usuario?.email || '',
        categoria: siguienteDocente.docente?.categoria || '',
        horaLlegada: 'En cola',
        posicionCola: siguienteDocente.posicion,
      }
    : null;

  const docentesColaMapeado = colaDocentes.map((a: any) => {
    const justificacion = notificaciones.find(
      (n: any) => n.metadata?.atencionId === a.id && n.metadata?.ventanaId === ventanaId
    );
    return {
      id: a.docente?.id || '',
      atencionId: a.id,
      nombre: a.docente?.usuario ? `${a.docente.usuario.nombre} ${a.docente.usuario.apellidos}` : 'Docente Desconocido',
      email: a.docente?.usuario?.email || '',
      categoria: a.docente?.categoria || '',
      horaLlegada: a.horaLlegada
        ? new Date(a.horaLlegada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : 'En espera',
      prioridad: 'normal' as const,
      estado: a.estado,
      observaciones: justificacion?.metadata || null,
      justificacionConfirmada: justificacion?.estado === 'LEIDA',
      fechaIngreso: a.docente?.fechaIngreso || null,
    };
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{ventana?.nombre}</h1>
            <span className="bg-primary-50 dark:bg-slate-700 text-primary-700 dark:text-unt-gold-light text-xs font-semibold px-2 py-1 rounded">
              Categoría: {ventana?.categoria}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Periodo Académico:{' '}
            <span className="font-semibold text-gray-700 dark:text-slate-300">{ventana?.periodo?.nombre}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onVolver && (
            <button
              onClick={onVolver}
              className="px-4 py-2 border dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors"
            >
              Volver a la Lista
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Users2 className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Total en Cola</p>
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{colaDocentes.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg"><Clock className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">En Espera</p>
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {colaDocentes.filter((a) => a.estado === 'ESPERANDO').length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><CheckCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Atendidos</p>
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {colaDocentes.filter((a) => a.estado === 'ATENDIDO').length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg"><AlertCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Ausentes</p>
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {colaDocentes.filter((a) => a.estado === 'AUSENTE').length}
            </p>
          </div>
        </div>
      </div>

      {/* Grid de control y cola */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ControlVentana
          estado={estadoVentana}
          tiempoTranscurrido={tiempoVentana}
          onIniciar={handleIniciarVentana}
          onPausar={handlePausarVentana}
          onReanudar={handleReanudarVentana}
          onFinalizar={handleFinalizarVentana}
          onSaltarTurno={handleSaltarTurno}
          subEstado={subEstado}
          docenteEnTurno={docenteEnTurno}
        />
        <div className="space-y-6">
          <PanelDocenteActual
            docente={docenteActualAdaptado}
            onFinalizar={handleConfirmarSeleccion}
            onCancelar={handleCancelarAtencion}
          />
          {estadoVentana === 'activa' && !docenteActual && (
            <PanelLlamarSiguiente
              docenteSiguiente={siguienteDocenteAdaptado}
              onLlamar={handleLlamarDocente}
              tiempoVentana={tiempoVentana}
              lastLlamadoSlot={lastLlamadoSlot}
            />
          )}
        </div>
        <ColaDocentes
          docentes={docentesColaMapeado}
          ventanaId={ventanaId}
          onJustificacionConfirmada={() => cargarDatosVentana()}
        />
      </div>

      {/* ── WORKSPACE ──────────────────────────────────────────────────────── */}
      {docenteActual && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden mt-8">
          {/* Header Workspace */}
          <div className="border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary-600" />
                Workspace de Programación: {docenteActual.usuario.nombre} {docenteActual.usuario.apellidos}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Asignación de asignaturas, grupos y ambientes en borrador para confirmación.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Toggle vista */}
              <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                <button
                  type="button"
                  onClick={() => setVistaWorkspace('calendario')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    vistaWorkspace === 'calendario'
                      ? 'bg-white dark:bg-slate-800 shadow text-[#1a365d] dark:text-unt-gold-light'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" />
                  Calendario
                </button>
                <button
                  type="button"
                  onClick={() => setVistaWorkspace('tarjetas')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    vistaWorkspace === 'tarjetas'
                      ? 'bg-white dark:bg-slate-800 shadow text-[#1a365d] dark:text-unt-gold-light'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Tarjetas
                </button>
              </div>

              <button
                onClick={handleConfirmarSeleccion}
                disabled={horariosBorrador.length === 0}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-lg shadow-sm transition-colors text-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Confirmar Selección ({horariosBorrador.length} bloques)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6">
            {/* ── Formulario (4 cols) ─────────────────────────────────────── */}
            <div className="lg:col-span-4 bg-gray-50/50 dark:bg-slate-700/30 p-5 rounded-xl border border-gray-100 dark:border-slate-600 space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-600 dark:text-slate-400 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {isEditing ? 'Editar Bloque Horario' : 'Nuevo Bloque Horario'}
              </h3>

              <form onSubmit={handleGuardarBloque} className="space-y-4">
                {/* Curso */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Asignatura / Curso *
                  </label>
                  <select
                    value={formState.cursoId}
                    onChange={(e) => setFormState({ ...formState, cursoId: e.target.value, grupoId: '' })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a365d] focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar curso...</option>
                    {cursosCarga.map((item) => {
                      const curso = item.planEstudioCurso?.curso || item.curso;
                      if (!curso) return null;
                      const horasProgramadas = allHorariosDocente
                        .filter(
                          (h: any) =>
                            (h.curso?.id === curso.id || h.cursoId === curso.id) &&
                            h.estado !== 'CANCELADO' &&
                            (!formState.id || h.id !== formState.id) &&
                            h.horaInicio &&
                            h.horaFin
                        )
                        .reduce((sum: number, h: any) => {
                          return (
                            sum +
                            parseInt(h.horaFin.split(':')[0], 10) -
                            parseInt(h.horaInicio.split(':')[0], 10)
                          );
                        }, 0);
                      const disponible = item.horasAsignadas - horasProgramadas;
                      return (
                        <option 
                          key={curso.id} 
                          value={curso.id}
                          disabled={disponible <= 0 && !isEditing}
                        >
                          {curso.codigo} - {curso.nombre} {disponible <= 0 ? '(Sin horas disponibles)' : `(Disponibles: ${disponible}h de ${item.horasAsignadas}h)`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Grupo */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Grupo / Sección *
                  </label>
                  <select
                    value={formState.grupoId}
                    onChange={(e) => setFormState({ ...formState, grupoId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a365d] focus:border-transparent disabled:opacity-50"
                    disabled={!formState.cursoId}
                    required
                  >
                    <option value="">Seleccionar grupo...</option>
                    {grupos.map((grupo) => (
                      <option key={grupo.id} value={grupo.id}>
                        Grupo {grupo.nombre} (Cap: {grupo.capacidad})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ambiente */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Ambiente / Aula / Laboratorio *
                  </label>
                  <select
                    value={formState.ambienteId}
                    onChange={(e) => setFormState({ ...formState, ambienteId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a365d] focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar ambiente...</option>
                    {ambientes.map((amb) => {
                      const disponibilidad = getDisponibilidadAmbiente(amb.id);
                      const isOcupado = !disponibilidad.disponible && disponibilidad.mensaje.startsWith('Ocupado');
                      return (
                        <option key={amb.id} value={amb.id} disabled={isOcupado}>
                          [{amb.tipo}] {amb.codigo} - {amb.nombre} {isOcupado ? `(Ocupado: ${disponibilidad.mensaje.replace('Ocupado (', '').replace(')', '')})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Instrucciones de Programación mediante Arrastre */}
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 rounded-xl p-4 flex items-start gap-3 mt-4">
                  <CalendarIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">¿Cómo programar?</p>
                    <p>1. Seleccione la <strong>Asignatura</strong>, el <strong>Grupo</strong> y el <strong>Ambiente</strong> de arriba.</p>
                    <p>2. Haga clic y arrastre sobre las celdas vacías del calendario de la derecha en el rango de horas que desee programar.</p>
                    <p>3. El bloque se validará y se guardará automáticamente en estado borrador.</p>
                  </div>
                </div>

                {/* Rango de tiempo seleccionado en calendario */}
                {selectedSlotRange && (
                  <div className="bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 dark:border-sky-500/30 rounded-xl p-4 space-y-3 mt-4">
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-5 w-5 text-sky-500 mt-0.5 shrink-0" />
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <p className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Horario Seleccionado</p>
                        <p className="mt-0.5">
                          <strong>Día:</strong> {selectedSlotRange.dia}
                        </p>
                        <p>
                          <strong>Rango:</strong> {selectedSlotRange.startHour}:00 - {selectedSlotRange.endHour}:00 ({selectedSlotRange.endHour - selectedSlotRange.startHour}h)
                        </p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => crearBloqueHorario(selectedSlotRange.dia, selectedSlotRange.startHour, selectedSlotRange.endHour)}
                      disabled={!formState.ambienteId || isSubmitting}
                      className="w-full flex items-center justify-center gap-2 bg-[#1a365d] hover:bg-[#254d84] text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <span className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Programar en este Horario
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSlotRange(null);
                        setFormState(prev => ({ ...prev, diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '10:00' }));
                      }}
                      className="w-full px-3 py-1.5 border dark:border-slate-600 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 transition-colors text-center"
                    >
                      Limpiar Selección
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-4 flex flex-col gap-2 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 dark:border-blue-500/30 rounded-xl p-4">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong>Modo Edición Activo:</strong> Puede cambiar el curso, grupo o ambiente arriba y luego arrastrar en el horario para guardarlo, o presione el botón de abajo para salir.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setFormState({ id: '', cursoId: '', grupoId: '', ambienteId: '', diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '10:00' });
                        setFormError(null);
                      }}
                      className="w-full px-3 py-1.5 border dark:border-slate-600 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 transition-colors"
                    >
                      Cancelar Edición
                    </button>
                  </div>
                )}

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* TABLAS DE DISPONIBILIDAD DE AMBIENTES */}
                {formState.cursoId && formState.horaInicio && formState.horaFin && (() => {
                  const aulas = ambientes.filter(a => a.tipo === 'AULA');
                  const labs = ambientes.filter(a => a.tipo === 'LABORATORIO');
                  
                  return (
                    <div className="border-t border-slate-200 dark:border-slate-600 pt-4 mt-2">
                      <h4 className="text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                        Ambientes disponibles para asignación
                      </h4>
                      
                      <div className="space-y-4">
                        {/* TEORÍA */}
                        <div>
                          <h5 className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mb-1">TEORÍA (Aulas):</h5>
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm overflow-hidden text-[10px] max-h-40 overflow-y-auto">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                <tr>
                                  <th className="px-2 py-1 font-medium text-slate-500 dark:text-slate-400">Ambiente</th>
                                  <th className="px-2 py-1 font-medium text-slate-500 dark:text-slate-400 text-center">Cap.</th>
                                  <th className="px-2 py-1 font-medium text-slate-500 dark:text-slate-400">Estado</th>
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
                                        if(disponible) setFormState(f => ({...f, ambienteId: a.id}));
                                      }}
                                    >
                                      <td className="px-2 py-1 font-medium dark:text-slate-200">
                                        {a.codigo}
                                        {formState.ambienteId === a.id && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                      </td>
                                      <td className="px-2 py-1 text-slate-500 dark:text-slate-400 text-center">{a.capacidad ?? '-'}</td>
                                      <td className="px-2 py-1">
                                        {disponible 
                                          ? <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5"/> Libre</span> 
                                          : <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5"><X className="w-2.5 h-2.5"/> {mensaje}</span>}
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
                          <h5 className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mb-1">LABORATORIO:</h5>
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm overflow-hidden text-[10px] max-h-40 overflow-y-auto">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                <tr>
                                  <th className="px-2 py-1 font-medium text-slate-500 dark:text-slate-400">Ambiente</th>
                                  <th className="px-2 py-1 font-medium text-slate-500 dark:text-slate-400 text-center">Cap.</th>
                                  <th className="px-2 py-1 font-medium text-slate-500 dark:text-slate-400">Estado</th>
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
                                        if(disponible) setFormState(f => ({...f, ambienteId: a.id}));
                                      }}
                                    >
                                      <td className="px-2 py-1 font-medium dark:text-slate-200">
                                        {a.codigo}
                                        {formState.ambienteId === a.id && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                      </td>
                                      <td className="px-2 py-1 text-slate-500 dark:text-slate-400 text-center">{a.capacidad ?? '-'}</td>
                                      <td className="px-2 py-1">
                                        {disponible 
                                          ? <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5"/> Libre</span> 
                                          : <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5"><X className="w-2.5 h-2.5"/> {mensaje}</span>}
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

              </form>
            </div>

            {/* ── Vista principal (8 cols) ─────────────────────────────────── */}
            <div className="lg:col-span-8 space-y-6">
              {/* Leyenda */}
              {cursosUnicos.length > 0 && (
                <div className="flex flex-wrap gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600 items-center">
                  <div className="flex items-center gap-1.5 mr-2 shrink-0">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Asignaturas:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cursosUnicos.map((c) => {
                      const col = getColorForCurso(c.codigo);
                      return (
                        <div
                          key={c.codigo}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm"
                        >
                          <span className={`w-2 h-2 rounded-full ${col.badge}`} />
                          <span>
                            <strong className="text-slate-900 dark:text-slate-100">{c.codigo}</strong>: {c.nombre}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Vista TARJETAS ── */}
              {vistaWorkspace === 'tarjetas' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-600 dark:text-slate-400 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Horarios Programados en Borrador
                    </h3>
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2.5 py-1 rounded-full">
                      Semana: {totalHorasSemana}h registradas
                    </span>
                  </div>

                  {horariosBorrador.length === 0 ? (
                    <div className="border dark:border-slate-600 border-dashed rounded-xl p-12 text-center text-gray-500 dark:text-slate-400">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-30 text-primary-600" />
                      <p className="font-semibold text-sm">No hay bloques de horario en borrador</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        Usa el formulario de la izquierda para registrar el primer bloque.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {horariosBorrador.map((bloque) => {
                        const col = getColorForCurso(bloque.curso?.codigo || 'DEFAULT');
                        return (
                          <div
                            key={bloque.id}
                            className={`bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-4 border-l-4 ${col.border}`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm ${col.badge}`}>
                                  {bloque.curso?.codigo || 'S/C'}
                                </span>
                                <span className="font-bold text-sm text-gray-900 dark:text-slate-100">
                                  {bloque.curso?.nombre || 'Curso Desconocido'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-slate-300 mt-2">
                                <div className="flex items-center gap-1">
                                  <Users2 className="h-3.5 w-3.5 text-gray-400" />
                                  <span>Grupo: {bloque.grupo?.nombre || 'General'}</span>
                                </div>
                                <div className="flex items-center gap-1 col-span-2">
                                  <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                  <span className="truncate">
                                    Ambiente: {bloque.ambiente?.codigo || 'Sin código'} - {bloque.ambiente?.nombre || 'Sin nombre'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 font-semibold text-[#1a365d]">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>
                                    {bloque.diaSemana ? (bloque.diaSemana.charAt(0) + bloque.diaSemana.slice(1).toLowerCase()) : 'Sin día'}{' '}
                                    {bloque.horaInicio || '--:--'} - {bloque.horaFin || '--:--'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-600 p-1 rounded-lg border dark:border-slate-500">
                              <button
                                onClick={() => handleEditarBloque(bloque)}
                                className="p-2 text-slate-500 dark:text-slate-300 hover:text-[#1a365d] dark:hover:text-white hover:bg-white dark:hover:bg-slate-500 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleEliminarBloque(bloque.id)}
                                className="p-2 text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-white dark:hover:bg-slate-500 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Vista CALENDARIO GRID ── */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-600 dark:text-slate-400 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Cuadrícula Horaria del Docente (Borrador + Confirmados)
                    </h3>
                    <span className="bg-[#1a365d] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                      Total Semana: {totalHorasSemana}h
                    </span>
                  </div>

                  <div className="shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse min-w-[800px] table-fixed">
                        <thead className="bg-[#1a365d] text-white">
                          <tr>
                            <th className="py-3 px-3 text-center font-semibold w-20 border-b border-slate-700">
                              HORA
                            </th>
                            {DIAS.map((d) => (
                              <th
                                key={d}
                                className="py-3 px-2 text-center font-bold tracking-wider border-b border-slate-700"
                              >
                                {DIA_LABEL[d]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {HORAS_NUM.map((horaNum, rowIndex) => {
                            return (
                              <tr
                                key={horaNum}
                                className={rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/30 dark:bg-slate-700/30'}
                              >
                                {/* HORA Izquierda */}
                                <td
                                  className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap"
                                >
                                  {`${horaNum.toString().padStart(2, '0')}:00`}
                                  <br />
                                  <span className="text-[10px] opacity-70">
                                    {`${(horaNum + 1).toString().padStart(2, '0')}:00`}
                                  </span>
                                </td>

                                {/* Celdas por día */}
                                {DIAS.map((dia) => {
                                  // ¿Esta celda está cubierta por un rowSpan de una fila anterior?
                                  const isCoveredDia = allHorariosDocente.some((h: any) => {
                                    if (h.diaSemana !== dia) return false;
                                    if (h.estado === 'CANCELADO') return false;
                                    if (!h.horaInicio || !h.horaFin) return false;
                                    const inicio = parseInt(h.horaInicio.split(':')[0], 10);
                                    const fin = parseInt(h.horaFin.split(':')[0], 10);
                                    return inicio < horaNum && fin > horaNum;
                                  });

                                  // Celdas cubiertas por rowSpan no se renderizan
                                  if (isCoveredDia) return null;

                                  // Clases que INICIAN a esta hora en este día
                                  const startingClasses = allHorariosDocente.filter((h: any) => {
                                    if (h.diaSemana !== dia) return false;
                                    if (h.estado === 'CANCELADO') return false;
                                    if (!h.horaInicio || !h.horaFin) return false;
                                    return parseInt(h.horaInicio.split(':')[0], 10) === horaNum;
                                  });

                                  if (startingClasses.length > 0) {
                                    // Usamos la duración máxima para el rowSpan de la celda
                                    const cellRowSpan = Math.max(
                                      ...startingClasses.map((h: any) => {
                                        return (
                                          parseInt(h.horaFin.split(':')[0], 10) -
                                          parseInt(h.horaInicio.split(':')[0], 10)
                                        );
                                      }),
                                      1
                                    );

                                    return (
                                      <td
                                        key={`${dia}-${horaNum}`}
                                        rowSpan={cellRowSpan}
                                        onMouseEnter={() => handleMouseEnterCell(dia, horaNum)}
                                        className="p-0 border-r border-b border-slate-200 dark:border-slate-700 align-top relative"
                                      >
                                        {/* Contenedor flex para múltiples clases en el mismo slot */}
                                        <div className="flex flex-col h-full w-full divide-y divide-black/5">
                                          {startingClasses.map((h: any) => {
                                            const col = getColorForCurso(h.curso?.codigo || 'DEFAULT');
                                            const esLab =
                                              h.ambiente?.codigo?.toUpperCase()?.includes('LAB') ||
                                              h.ambiente?.tipo === 'LABORATORIO';
                                            const isBorrador = h.estado === 'BORRADOR';
                                            const dur =
                                              parseInt(h.horaFin.split(':')[0], 10) -
                                              parseInt(h.horaInicio.split(':')[0], 10);
                                            const isCompact = dur <= 1;

                                            return (
                                              <div
                                                key={h.id}
                                                className={cn(
                                                  'group relative flex flex-col w-full border-l-4 transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer flex-1 overflow-hidden',
                                                  isCompact ? 'p-1.5' : 'p-2.5',
                                                  col.bg,
                                                  col.border,
                                                  col.text
                                                )}
                                              >
                                                {/* Fila superior: tipo + horario */}
                                                <div
                                                  className={cn(
                                                    'flex justify-between items-start gap-1',
                                                    isCompact ? 'mb-0.5' : 'mb-1.5'
                                                  )}
                                                >
                                                  <span
                                                    className={cn(
                                                      'font-bold rounded text-white shadow-sm shrink-0',
                                                      isCompact
                                                        ? 'text-[8px] px-1 py-0'
                                                        : 'text-[9px] px-1.5 py-0.5',
                                                      col.badge
                                                    )}
                                                  >
                                                    {esLab ? 'LAB' : 'TEORÍA'}
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      'font-mono font-semibold whitespace-nowrap bg-white/40 px-1 rounded shrink-0',
                                                      isCompact ? 'text-[7.5px]' : 'text-[9px]'
                                                    )}
                                                  >
                                                    {h.horaInicio} - {h.horaFin}
                                                  </span>
                                                </div>

                                                {/* Código y nombre del curso */}
                                                <div
                                                  className={cn(
                                                    'font-bold leading-tight',
                                                    isCompact ? 'text-[10px]' : 'text-xs mb-0.5'
                                                  )}
                                                >
                                                  {h.curso?.codigo || 'S/C'}
                                                </div>
                                                {!isCompact && (
                                                  <div
                                                    className="text-[10px] leading-tight opacity-95 line-clamp-2 mb-1.5"
                                                    title={h.curso?.nombre || ''}
                                                  >
                                                    {h.curso?.nombre || 'Curso Desconocido'}
                                                  </div>
                                                )}

                                                {/* Footer: grupo + ambiente */}
                                                <div
                                                  className={cn(
                                                    'mt-auto flex flex-col gap-0.5 font-medium pt-1.5 border-t border-black/5',
                                                    isCompact
                                                      ? 'text-[8px]'
                                                      : 'text-[9px] opacity-85'
                                                  )}
                                                >
                                                  <div className="flex items-center gap-1">
                                                    <Users2 className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>
                                                      {h.grupo?.nombre
                                                        ? `Gr. ${h.grupo.nombre}`
                                                        : 'Sin Gr.'}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span className="truncate">{h.ambiente?.codigo || 'Sin aula'}</span>
                                                  </div>
                                                </div>

                                                {/* Controles (solo borrador) — visibles al hover */}
                                                {isBorrador && (
                                                  <div className="absolute top-1.5 right-1.5 flex items-center bg-white/70 p-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleConfirmarBloque(h.id);
                                                      }}
                                                      title="Confirmar"
                                                      className="p-0.5 hover:bg-green-100 text-green-600 rounded transition-colors"
                                                    >
                                                      <Check className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditarBloque(h);
                                                      }}
                                                      title="Editar"
                                                      className="p-0.5 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEliminarBloque(h.id);
                                                      }}
                                                      title="Eliminar"
                                                      className="p-0.5 hover:bg-red-100 text-red-600 rounded transition-colors"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </td>
                                    );
                                  }

                                  // Celda vacía
                                  return (() => {
                                    const isDocenteDisponible = disponibilidadDocente.length === 0 || disponibilidadDocente.some((d: any) => {
                                      if (d.diaSemana !== dia) return false;
                                      const hInicio = parseInt(d.horaInicio.split(':')[0], 10);
                                      const hFin = parseInt(d.horaFin.split(':')[0], 10);
                                      return horaNum >= hInicio && horaNum < hFin;
                                    });

                                    if (!isDocenteDisponible) {
                                      return (
                                        <td
                                          key={`${dia}-${horaNum}`}
                                          className="p-0 border-r border-b border-slate-200 dark:border-slate-700 align-middle text-center bg-slate-100 dark:bg-slate-900/50 relative cursor-not-allowed select-none min-h-[50px]"
                                          style={{
                                            backgroundImage: 'repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.1), rgba(148, 163, 184, 0.1) 5px, transparent 5px, transparent 10px)'
                                          }}
                                          title="Docente no disponible en este horario (Declaración de disponibilidad)"
                                        >
                                          <div className="flex items-center justify-center h-full w-full opacity-60">
                                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">No disponible</span>
                                          </div>
                                        </td>
                                      );
                                    }

                                    const isCellOcupadaPorAmbiente = formState.ambienteId ? todosLosHorarios.some((h) => {
                                      if (formState.id && h.id === formState.id) return false;
                                      if (!h.ambiente || h.ambiente.id !== formState.ambienteId) return false;
                                      if (h.diaSemana !== dia) return false;
                                      if (h.estado === 'CANCELADO') return false;
                                      if (!h.horaInicio || !h.horaFin) return false;
                                      const hStart = parseInt(h.horaInicio.split(':')[0], 10);
                                      const hEnd = parseInt(h.horaFin.split(':')[0], 10);
                                      return horaNum >= hStart && horaNum < hEnd;
                                    }) : false;

                                    if (isCellOcupadaPorAmbiente) {
                                      return (
                                        <td
                                          key={`${dia}-${horaNum}`}
                                          onMouseEnter={() => handleMouseEnterCell(dia, horaNum)}
                                          className="p-0 border-r border-b border-slate-200 dark:border-slate-700 align-middle text-center bg-red-500/5 dark:bg-red-500/10 relative cursor-not-allowed select-none min-h-[50px]"
                                          style={{
                                            backgroundImage: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.08) 5px, transparent 5px, transparent 10px)'
                                          }}
                                          title="Ambiente ocupado por otra asignatura"
                                        >
                                          <div className="flex items-center justify-center h-full w-full opacity-60">
                                            <Lock className="h-3.5 w-3.5 text-red-500/70 dark:text-red-400/60" />
                                          </div>
                                        </td>
                                      );
                                    }

                                    const isCellOcupadaPorGrupo = formState.grupoId ? todosLosHorarios.some((h) => {
                                      if (formState.id && h.id === formState.id) return false;
                                      if (!h.cursoDocenteGrupo || h.cursoDocenteGrupo.id !== formState.grupoId) return false;
                                      if (h.diaSemana !== dia) return false;
                                      if (h.estado === 'CANCELADO') return false;
                                      if (!h.horaInicio || !h.horaFin) return false;
                                      const hStart = parseInt(h.horaInicio.split(':')[0], 10);
                                      const hEnd = parseInt(h.horaFin.split(':')[0], 10);
                                      return horaNum >= hStart && horaNum < hEnd;
                                    }) : false;

                                    if (isCellOcupadaPorGrupo) {
                                      return (
                                        <td
                                          key={`${dia}-${horaNum}`}
                                          className="p-0 border-r border-b border-slate-200 dark:border-slate-700 align-middle text-center bg-amber-500/5 dark:bg-amber-500/10 relative cursor-not-allowed select-none min-h-[50px]"
                                          style={{
                                            backgroundImage: 'repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.08) 5px, transparent 5px, transparent 10px)'
                                          }}
                                          title="El grupo ya tiene una clase programada en este horario"
                                        >
                                          <div className="flex items-center justify-center h-full w-full opacity-60">
                                            <Lock className="h-3.5 w-3.5 text-amber-500/70 dark:text-amber-400/60" />
                                          </div>
                                        </td>
                                      );
                                    }

                                    const isSelectedInDrag = isDragging &&
                                      dragStart &&
                                      dragEnd &&
                                      dragStart.dia === dia &&
                                      horaNum >= Math.min(dragStart.horaIndex, dragEnd.horaIndex) &&
                                      horaNum <= Math.max(dragStart.horaIndex, dragEnd.horaIndex);

                                    const isSelectedInSelectedRange = selectedSlotRange &&
                                      selectedSlotRange.dia === dia &&
                                      horaNum >= selectedSlotRange.startHour &&
                                      horaNum < selectedSlotRange.endHour;

                                    const isDragValid = isSelectedInDrag ? (() => {
                                      const startHour = Math.min(dragStart.horaIndex, dragEnd.horaIndex);
                                      const endHour = Math.max(dragStart.horaIndex, dragEnd.horaIndex) + 1;
                                      
                                      // Disponibilidad del docente
                                      if (disponibilidadDocente.length > 0) {
                                        for (let h = startHour; h < endHour; h++) {
                                          const slotDisp = disponibilidadDocente.some((d: any) => {
                                            if (d.diaSemana !== dia) return false;
                                            const hInicio = parseInt(d.horaInicio.split(':')[0], 10);
                                            const hFin = parseInt(d.horaFin.split(':')[0], 10);
                                            return h >= hInicio && h < hFin;
                                          });
                                          if (!slotDisp) return false;
                                        }
                                      }

                                      // Cruce docente
                                      const cruceDoc = allHorariosDocente.some((h) => {
                                        if (h.diaSemana !== dia) return false;
                                        if (h.estado === 'CANCELADO') return false;
                                        if (!h.horaInicio || !h.horaFin) return false;
                                        const hStart = parseInt(h.horaInicio.split(':')[0], 10);
                                        const hEnd = parseInt(h.horaFin.split(':')[0], 10);
                                        return Math.max(hStart, startHour) < Math.min(hEnd, endHour);
                                      });
                                      if (cruceDoc) return false;


                                      // Cruce grupo


                                      const cruceGrupo = formState.grupoId ? todosLosHorarios.some((h) => {


                                        if (formState.id && h.id === formState.id) return false;


                                        if (h.diaSemana !== dia) return false;


                                        if (h.estado === 'CANCELADO') return false;


                                        if (!h.cursoDocenteGrupo || h.cursoDocenteGrupo.id !== formState.grupoId) return false;


                                        if (!h.horaInicio || !h.horaFin) return false;


                                        const hStart = parseInt(h.horaInicio.split(':')[0], 10);


                                        const hEnd = parseInt(h.horaFin.split(':')[0], 10);


                                        return Math.max(hStart, startHour) < Math.min(hEnd, endHour);


                                      }) : false;


                                      if (cruceGrupo) return false;

                                      // Cruce ambiente
                                      const cruceAmb = todosLosHorarios.some((h) => {
                                        if (h.diaSemana !== dia) return false;
                                        if (h.estado === 'CANCELADO') return false;
                                        if (!h.ambiente || h.ambiente.id !== formState.ambienteId) return false;
                                        if (!h.horaInicio || !h.horaFin) return false;
                                        const hStart = parseInt(h.horaInicio.split(':')[0], 10);
                                        const hEnd = parseInt(h.horaFin.split(':')[0], 10);
                                        return Math.max(hStart, startHour) < Math.min(hEnd, endHour);
                                      });
                                      if (cruceAmb) return false;

                                      // Horas del curso
                                      if (!formState.cursoId) return false;
                                      const cursoCarga = cursosCarga.find((item) => (item.planEstudioCurso?.curso?.id || item.curso?.id) === formState.cursoId);
                                      const horasAsignadas = cursoCarga?.horasAsignadas || 0;
                                      const horasProgramadas = allHorariosDocente
                                        .filter((h) => (h.curso?.id === formState.cursoId || h.cursoId === formState.cursoId) && h.estado !== 'CANCELADO' && h.horaInicio && h.horaFin)
                                        .reduce((sum, h) => {
                                          const hInicio = parseInt(h.horaInicio.split(':')[0], 10);
                                          const hFin = parseInt(h.horaFin.split(':')[0], 10);
                                          return sum + (hFin - hInicio);
                                        }, 0);
                                      const duracion = endHour - startHour;
                                      if (horasProgramadas + duracion > horasAsignadas) return false;

                                      return true;
                                    })() : true;

                                    const highlightClass = isSelectedInDrag
                                      ? (isDragValid
                                          ? "bg-emerald-100/60 dark:bg-emerald-950/40 border-dashed border-emerald-500 border-2"
                                          : "bg-red-100/60 dark:bg-red-950/40 border-dashed border-red-500 border-2")
                                      : isSelectedInSelectedRange
                                        ? "bg-sky-100/60 dark:bg-sky-950/40 border-dashed border-sky-500 border-2"
                                        : "bg-white dark:bg-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-700/30";

                                    return (
                                      <td
                                        key={`${dia}-${horaNum}`}
                                        onMouseDown={(e) => handleMouseDown(e, dia, horaNum)}
                                        onMouseEnter={() => handleMouseEnterCell(dia, horaNum)}
                                        className={cn(
                                          "p-0 border-r border-b border-slate-200 dark:border-slate-700 align-top transition-colors select-none min-h-[50px]",
                                          highlightClass
                                        )}
                                        style={{ cursor: formState.cursoId && formState.grupoId ? 'cell' : 'default' }}
                                      />
                                    );
                                  })()
                                })}


                              </tr>
                            );
                          })}

                          {/* Fila de totales */}
                          <tr className="bg-slate-800 text-white font-bold text-xs uppercase">
                            <td className="py-3 px-2 text-center border-r border-slate-700">TOTAL</td>
                            {DIAS.map((dia) => (
                              <td key={dia} className="py-3 px-2 text-center border-r border-slate-700">
                                {getHorasDia(dia)}h
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}