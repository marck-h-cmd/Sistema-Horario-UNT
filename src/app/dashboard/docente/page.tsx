'use client';

import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, DiaSemana } from '@prisma/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { apiGet, apiPost, apiPut, ApiClientError } from '@/lib/api-client';
import { useDisponibilidad } from '@/hooks/useDisponibilidad';
import { 
  Loader2, Calendar, Clock, TrendingUp, Users, 
  Bell, CheckCircle2, AlertTriangle, Timer, 
  ArrowRight, MessageSquare, Info, X, CheckSquare, Square, Save,
  ShieldCheck, FileText, ExternalLink, FlaskConical, BookOpen, MapPin
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { PieChartCard } from '@/components/charts/PieChartCard';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Boton } from '@/components/ui/Boton';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalTitle, 
  ModalFooter,
  ModalDescription 
} from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

interface HorarioItem {
  id: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  curso: { nombre: string; codigo: string };
  ambiente: { codigo: string; nombre: string; tipo: string };
  grupo?: { nombre: string };
}

interface VentanaAtencion {
  id: string;
  nombre: string;
  estado: string;
  posicionCola?: number;
  turnoActual?: number;
  periodo?: { nombre: string };
  atencionEstado?: 'ESPERANDO' | 'ATENDIENDO' | 'FINALIZADO' | 'AUSENTE' | 'JUSTIFICADO';
  fechaIngresoDocente?: string;
  categoriaDocente?: string;
  tiempoRestanteSegundos?: number;
}

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  canal: 'CORREO' | 'WHATSAPP' | 'TELEGRAM' | 'SISTEMA';
  estado: 'ENVIADA' | 'PENDIENTE' | 'FALLIDA' | 'LEIDA';
  createdAt: string;
}

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIAS_LABEL: Record<string, string> = {
  LUNES: 'LUNES',
  MARTES: 'MARTES',
  MIERCOLES: 'MIÉRCOLES',
  JUEVES: 'JUEVES',
  VIERNES: 'VIERNES',
  SABADO: 'SÁBADO',
};

const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 to 20

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

const NOTIF_ICONS: Record<string, any> = {
  TURNO: <Timer className="h-4 w-4 text-emerald-500" />,
  CONFIRMADO: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  MODIFICADO: <Info className="h-4 w-4 text-amber-500" />,
  SISTEMA: <Bell className="h-4 w-4 text-slate-500" />,
  AUSENCIA: <X className="h-4 w-4 text-rose-500" />,
};

const calcDuracion = (inicio: string, fin: string): number => { 
  const h1 = parseInt(inicio.split(':')[0]); 
  const h2 = parseInt(fin.split(':')[0]); 
  return Math.max(1, h2 - h1); 
};

const getBadgeEstadoTurno = (estado?: string) => {
  switch (estado) {
    case 'ESPERANDO':
      return <Badge className="bg-slate-400 dark:bg-slate-600 text-white border-none">En espera</Badge>;
    case 'EN_ATENCION':
      return <Badge className="bg-blue-600 text-white border-none">En atención</Badge>;
    case 'ATENDIDO':
      return <Badge className="bg-emerald-500 text-white border-none">Atendido</Badge>;
    case 'AUSENTE':
      return <Badge className="bg-amber-500 text-white border-none">Justificado</Badge>;
    case 'CANCELADO':
      return <Badge className="bg-rose-600 text-white border-none">Cancelado</Badge>;
    default:
      return null;
  }
};

export default function DocenteDashboardPage() {
  const { user, loading: authLoading } = useRequireAuth([Rol.DOCENTE]);
  const [activeTab, setActiveTab] = useState<'horario' | 'ventana' | 'notificaciones' | 'disponibilidad'>('horario');
  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [ventana, setVentana] = useState<VentanaAtencion | null>(null);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docenteId, setDocenteId] = useState<string | undefined>(undefined);
  
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const [justifying, setJustifying] = useState(false);
  const [justified, setJustified] = useState(false);
  const [justifyForm, setJustifyForm] = useState({ tipo: '', motivo: '', documento: '' });

  const [timeLeft, setTimeLeft] = useState(900);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { slots, loading: slotsLoading, saving, error: slotsError, obtenerDisponibilidadDocente, guardarDisponibilidadDocente } = useDisponibilidad();
  const [localSlots, setLocalSlots] = useState<Set<string>>(new Set());
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    if (user?.docenteId) setDocenteId(user.docenteId);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user && !docenteId && !user.docenteId) {
      const fetchDocenteId = async () => {
        try {
          const res = await apiGet<{ id: string }>(`/api/docentes/buscar`, { usuarioId: user.id });
          if (res.data?.id) {
            setDocenteId(res.data.id);
          } else {
            setError('No se pudo encontrar el registro de docente asociado a tu usuario.');
            setLoading(false);
          }
        } catch {
          setError('Error al buscar datos del docente.');
          setLoading(false);
        }
      };
      fetchDocenteId();
    }
  }, [user, authLoading, docenteId]);

  const fetchData = useCallback(async () => {
    if (!docenteId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const [horariosRes, ventanaRes, notifsRes] = await Promise.all([
        apiGet<HorarioItem[]>(`/api/horarios`, { docenteId, estado: 'PUBLICADO' }),
        apiGet<VentanaAtencion>(`/api/ventanas-atencion/activa`, { docenteId }),
        apiGet<Notificacion[]>(`/api/notificaciones`, { limit: 30, usuarioId: user.id }),
      ]);
      setHorarios(horariosRes.data || []);
      
      const activeVentana = ventanaRes.data || null;
      setVentana(activeVentana);
      if (activeVentana && activeVentana.tiempoRestanteSegundos !== undefined) {
        setTimeLeft(activeVentana.tiempoRestanteSegundos);
      } else {
        setTimeLeft(900);
      }
      
      setNotificaciones(notifsRes.data || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [docenteId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWS = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/api/websocket`);
        
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'cola:actualizada' || msg.type === 'cola:cambio') {
              fetchData();
            }
          } catch (err) {
            console.error('Error procesando mensaje WebSocket:', err);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWS, 5000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        console.error('Error al conectar WebSocket:', err);
      }
    };

    connectWS();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [fetchData]);

  useEffect(() => {
    if (docenteId && activeTab === 'disponibilidad') {
      obtenerDisponibilidadDocente(docenteId);
    }
  }, [docenteId, activeTab, obtenerDisponibilidadDocente]);

  useEffect(() => {
    const newSet = new Set<string>();
    slots.forEach(s => newSet.add(`${s.diaSemana}-${s.horaInicio}`));
    setLocalSlots(newSet);
  }, [slots]);

  const toggleSlot = (dia: string, hora: string) => {
    const key = `${dia}-${hora}`;
    setLocalSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveDisponibilidad = async () => {
    if (!docenteId) return;
    const nuevosSlots = Array.from(localSlots).map(key => {
      const [diaSemana, horaInicio] = key.split('-');
      const h = parseInt(horaInicio.split(':')[0]);
      const horaFin = `${(h + 1).toString().padStart(2, '0')}:00`;
      return { diaSemana, horaInicio, horaFin };
    });
    
    const success = await guardarDisponibilidadDocente(docenteId, nuevosSlots);
    if (success) {
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }
  };

  const handleMarcarAusente = useCallback(async () => {
    if (!ventana) return;
    try {
      await apiPost(`/api/ventanas-atencion/${ventana.id}/marcar-ausente`, {});
      fetchData();
    } catch (err) {
      console.error('Error al marcar como ausente:', err);
    }
  }, [ventana, fetchData]);

  useEffect(() => {
    const esTurno = ventana && ventana.posicionCola === ventana.turnoActual && (ventana.estado === 'ABIERTA' || ventana.estado === 'EN_CURSO');
    
    if (esTurno && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && esTurno) {
      handleMarcarAusente();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ventana, timeLeft, handleMarcarAusente]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJustificar = async () => {
    if (!ventana) return;
    setJustifying(true);
    try {
      await apiPost(`/api/ventanas-atencion/${ventana.id}/justificar`, justifyForm);
      setJustified(true);
      setShowJustifyModal(false);
      fetchData();
    } catch (err: any) {
      setError(err instanceof ApiClientError ? err.message : 'Error al registrar justificación');
    } finally {
      setJustifying(false);
    }
  };

  const handleLeerNotificacion = async (id: string) => {
    try {
      await apiPut(`/api/notificaciones/${id}/leer`, {});
      setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, estado: 'LEIDA' } : n));
    } catch (err) {
      console.error('Error al marcar como leída:', err);
    }
  };

  const handleMarcarTodasLeidas = async () => {
    if (!user) return;
    try {
      await apiPut('/api/notificaciones/leer-todas', { usuarioId: user.id });
      setNotificaciones(prev => prev.map(n => ({ ...n, estado: 'LEIDA' })));
    } catch (err) {
      console.error('Error al marcar todas como leídas:', err);
    }
  };

  const unreadCount = notificaciones.filter(n => n.estado !== 'LEIDA').length;

  const calcularAntiguedad = (fecha?: string) => {
    if (!fecha) return '—';
    const ing = new Date(fecha);
    const hoy = new Date();
    let years = hoy.getFullYear() - ing.getFullYear();
    const m = hoy.getMonth() - ing.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < ing.getDate())) years--;
    return `${years} años de servicio`;
  };

  // CÁLCULOS CORRECTOS
  const totalSesiones = horarios.length;
  
  const horasPorDia: Record<string, number> = {}; 
  DIAS.forEach(dia => { horasPorDia[dia] = 0; }); 
  horarios.forEach(h => { 
    if (!h.diaSemana || !h.horaInicio || !h.horaFin) return;
    const inicio = parseInt(h.horaInicio.split(':')[0]); 
    const fin = parseInt(h.horaFin.split(':')[0]); 
    horasPorDia[h.diaSemana] = (horasPorDia[h.diaSemana] || 0) + (fin - inicio); 
  }); 
  const totalHorasSemanal = Object.values(horasPorDia).reduce((a, b) => a + b, 0);

  // Calcular horas por tipo
  const horasTeoria = horarios.reduce((acc, h) => {
    if (!h.horaInicio || !h.horaFin) return acc;
    if (!h.ambiente || h.ambiente.tipo !== 'LABORATORIO') {
      const inicio = parseInt(h.horaInicio.split(':')[0]);
      const fin = parseInt(h.horaFin.split(':')[0]);
      return acc + (fin - inicio);
    }
    return acc;
  }, 0);
  const horasLaboratorio = totalHorasSemanal - horasTeoria;
  
  const cursosAsignados = new Set(horarios.map(h => h.curso?.codigo)).size;

  // MATRIZ Y HORAS BLOQUEADAS PARA ROWSPAN
  const horasBloqueadasPorDia: Record<string, Set<string>> = {}; 
  const matriz: Record<string, Record<string, HorarioItem>> = {};
  
  DIAS.forEach(dia => { 
    horasBloqueadasPorDia[dia] = new Set<string>(); 
    matriz[dia] = {};
  });

  horarios.filter(h => {
    // Validar que diaSemana esté en DIAS y no sea DOMINGO
    if (!h.diaSemana || !DIAS.includes(h.diaSemana) || h.diaSemana === 'DOMINGO') {
      return false;
    }
    return true;
  }).forEach(h => { 
    if (!h.horaInicio || !h.horaFin) return;
    const inicio = parseInt(h.horaInicio.split(':')[0]); 
    const fin = parseInt(h.horaFin.split(':')[0]); 
    matriz[h.diaSemana][h.horaInicio] = h;
    for (let hora = inicio + 1; hora < fin; hora++) { 
      horasBloqueadasPorDia[h.diaSemana].add(`${hora.toString().padStart(2,'0')}:00`); 
    } 
  });

  const HORAS_STRINGS = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  ];

  const horasARenderizar = HORAS_STRINGS;

  const horasConClase = HORAS_STRINGS.filter(h => DIAS.some(d => matriz[d]?.[h] || horasBloqueadasPorDia[d]?.has(h)));
  const cursosUnicos = Array.from(new Set(horarios.map(h => h.curso?.codigo)));
  const cursoColorMap: Record<string, any> = {};
  cursosUnicos.forEach((codigo, index) => {
    cursoColorMap[codigo] = COLORES_CURSO[index % COLORES_CURSO.length];
  });

  const pieData = cursosUnicos.map(codigo => ({
    name: codigo,
    value: horarios.filter(h => h.curso?.codigo === codigo && h.horaInicio && h.horaFin).reduce((acc, h) => {
      const inicio = parseInt(h.horaInicio.split(':')[0]);
      const fin = parseInt(h.horaFin.split(':')[0]);
      return acc + (fin - inicio);
    }, 0),
  }));
  const barData = DIAS.map(dia => ({
    dia: DIAS_LABEL[dia],
    sesiones: horasPorDia[dia] || 0,
  }));

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bienvenido, ${user?.nombre} ${user?.apellidos}`}
        actions={
          <Link
            href="/dashboard/docente/cursos"
            className="inline-flex items-center gap-2 rounded-lg bg-unt-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-unt-blue/90"
          >
            Mis cursos y grupos
          </Link>
        }
      />

      {error && <ErrorAlert message={error} />}

      {/* KPIs SECTION */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Carga Lectiva', value: `${totalHorasSemanal}h`, icon: <Clock className="h-6 w-6" />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Horas Teoría', value: `${horasTeoria}h`, icon: <BookOpen className="h-6 w-6" />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Horas Laboratorio', value: `${horasLaboratorio}h`, icon: <FlaskConical className="h-6 w-6" />, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Asignaturas', value: cursosAsignados, icon: <TrendingUp className="h-6 w-6" />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map((kpi, i) => (
          <div key={i} className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${kpi.bg} ${kpi.color} transition-transform group-hover:scale-110`}>
                {kpi.icon}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">{kpi.label}</p>
                <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {loading ? '...' : kpi.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TABS SECTION */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'horario', label: 'Mi Horario Semanal', icon: <Calendar className="h-4 w-4" /> },
          { id: 'disponibilidad', label: 'Mi Disponibilidad', icon: <Clock className="h-4 w-4" /> },
          { id: 'ventana', label: 'Ventanilla Virtual', icon: <Users className="h-4 w-4" /> },
          { id: 'notificaciones', label: 'Centro de Mensajes', icon: <Bell className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all rounded-xl whitespace-nowrap",
              activeTab === tab.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'notificaciones' && unreadCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card min-h-[400px]">
        {activeTab === 'horario' && (
          <div className="p-8 space-y-6">
             <div className="bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 text-blue-850 dark:text-blue-200 text-xs sm:text-sm font-semibold rounded-xl p-4 flex items-center gap-2.5 mb-6">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Solo se muestran horarios oficiales en estado <strong className="text-blue-900 dark:text-white uppercase">PUBLICADO</strong>. Los horarios en borrador o pendientes de validación por coordinación no son mostrados en este panel.</span>
             </div>

             <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
                <PieChartCard title="Distribución de Horas" data={pieData} loading={loading} />
                <BarChartCard title="Actividad Semanal" data={barData} xKey="dia" dataKey="sesiones" color="#c9a84c" loading={loading} />
              </div>
              
              {cursosUnicos.length > 0 && (
                <div className="flex flex-wrap gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm items-center">
                  <div className="flex items-center gap-2 mr-2">
                     <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                     <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Asignaturas:</span>
                  </div>
                  {cursosUnicos.map(c => {
                    const col = cursoColorMap[c];
                    return (
                      <div key={c} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-600">
                        <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", col.badge)}></span>
                        <span>{c}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {horasConClase.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-700 p-12 text-center bg-white dark:bg-slate-800">
                  <div className="mb-4 text-4xl">📅</div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sin horario confirmado</h3>
                  <p className="text-slate-500 dark:text-slate-400">Tu horario oficial aparecerá aquí una vez sea validado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                   <table className="w-full min-w-[1000px] border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800">
                        <tr>
                          <th className="p-4 text-[10px] uppercase font-black bg-slate-100 dark:bg-slate-800 text-slate-400">Hora</th>
                          {DIAS.map(d => <th key={d} className="p-4 text-xs uppercase font-black text-slate-700 dark:text-white bg-slate-100 dark:bg-slate-800 tracking-widest">{DIAS_LABEL[d]}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {horasARenderizar.map(hora => { 
                          return (
                          <tr key={hora} className="bg-white dark:bg-slate-800"> 
                            <td 
                              className="bg-slate-100 dark:bg-slate-700 p-4 text-center border-r border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-500 dark:text-slate-300 whitespace-nowrap"
                            >
                              <div className="font-semibold">{hora}</div>
                              <div className="text-[10px] opacity-60">
                                {`${(parseInt(hora.split(':')[0]) + 1).toString().padStart(2,'0')}:00`}
                              </div>
                            </td> 
                            {DIAS.map(dia => { 
                              if (horasBloqueadasPorDia[dia]?.has(hora)) return null; 
                              const sesion = matriz[dia]?.[hora]; 
                              const duracion = sesion ? calcDuracion(sesion.horaInicio, sesion.horaFin) : 1; 
                              if (!sesion) return <td key={dia} className="p-1 border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900" />;
                              const colors = cursoColorMap[sesion.curso.codigo];
                              const esLab = sesion.ambiente?.tipo === 'LABORATORIO';
                              return ( 
                                <td key={dia} rowSpan={duracion} className="p-1.5 border-l border-slate-100 dark:border-slate-800"> 
                                  <div className={cn("rounded-xl border-l-4 p-3 shadow-sm", 
                                    esLab 
                                      ? "bg-emerald-50 dark:bg-slate-700 border-emerald-500 dark:border-emerald-400" 
                                      : "bg-indigo-50 dark:bg-slate-700 border-indigo-500 dark:border-indigo-400"
                                  )}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black text-white", 
                                        esLab ? "bg-emerald-500" : "bg-indigo-500"
                                      )}>
                                        {sesion.ambiente?.tipo || 'TEORIA'}
                                      </span>
                                      <span className="text-[9px] font-bold opacity-60">{sesion.horaInicio}-{sesion.horaFin}</span>
                                    </div>
                                    <p className={cn("text-xs font-black mb-1", 
                                      esLab 
                                        ? "text-emerald-900 dark:text-white" 
                                        : "text-indigo-900 dark:text-white"
                                    )}>{sesion.curso.nombre}</p>
                                    <div className={cn("text-[10px] font-bold flex items-center gap-2",
                                      esLab 
                                        ? "text-emerald-600 dark:text-slate-400" 
                                        : "text-indigo-600 dark:text-slate-400"
                                    )}>
                                      <Users className="h-3 w-3" /> Grupo {sesion.grupo?.nombre || 'A'}
                                    </div>
                                    <div className={cn("text-[10px] font-bold flex items-center gap-2 mt-1",
                                      esLab 
                                        ? "text-emerald-600 dark:text-slate-400" 
                                        : "text-indigo-600 dark:text-slate-400"
                                    )}>
                                      <MapPin className="h-3 w-3" /> {sesion.ambiente?.codigo || 'Sin aula'}
                                    </div>
                                  </div>
                                </td> 
                              ); 
                            })} 
                          </tr> 
                          );
                        })}
                      </tbody>
                   </table>
                </div>
              )}
          </div>
        )}

        {activeTab === 'disponibilidad' && (
          <div className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Disponibilidad Horaria</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Marca las horas en las que estás disponible para que se te asignen clases.</p>
              </div>
              <div className="flex items-center gap-3">
                {showSaveSuccess && (
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in slide-in-from-right-4">
                    <CheckCircle2 className="h-4 w-4" /> Guardado
                  </span>
                )}
                <Boton
                  onClick={handleSaveDisponibilidad}
                  disabled={saving || slotsLoading}
                  className="bg-unt-blue hover:bg-unt-blue/90 text-white font-bold flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar Cambios
                </Boton>
              </div>
            </div>

            {slotsError && <ErrorAlert message={slotsError} />}

            {slotsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[800px] border-collapse select-none">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="p-4 text-[10px] uppercase font-black bg-slate-100 dark:bg-slate-800 text-slate-400">Hora</th>
                      {DIAS.map(d => <th key={d} className="p-4 text-xs uppercase font-black text-slate-700 dark:text-white bg-slate-100 dark:bg-slate-800 tracking-widest">{DIAS_LABEL[d] || d}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {HORAS_STRINGS.map(hora => (
                      <tr key={hora} className="bg-white dark:bg-slate-900">
                        <td className="bg-slate-50 dark:bg-slate-800 p-4 text-center border-r border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {hora}
                        </td>
                        {DIAS.map(dia => {
                          const isAvailable = localSlots.has(`${dia}-${hora}`);
                          return (
                            <td 
                              key={`${dia}-${hora}`} 
                              className="p-1 border-l border-slate-100 dark:border-slate-800"
                              onClick={() => toggleSlot(dia, hora)}
                            >
                              <div className={cn(
                                "h-full w-full p-4 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2",
                                isAvailable 
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400" 
                                  : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-600 text-slate-300 dark:text-slate-600 hover:text-slate-400"
                              )}>
                                {isAvailable ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ventana' && (
          <div className="p-8">
            {!ventana ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-slate-800 dark:bg-slate-800 border border-slate-700 rounded-2xl p-10">
                <div className="rounded-full bg-slate-700 p-6">
                  <Clock className="h-12 w-12 text-slate-200" />
                </div>
                <div className="max-w-xs">
                  <h3 className="text-xl font-bold text-slate-100">No hay ventanas de atención activas</h3>
                  <p className="text-sm text-slate-400 mt-2">
                    El administrador abrirá una ventana cuando sea el momento de seleccionar horarios.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto">
                {ventana.posicionCola !== undefined && 
                 (ventana.posicionCola !== ventana.turnoActual || ventana.atencionEstado === 'AUSENTE') && (
                  <Card className="border-unt-blue/20 bg-blue-50/30 p-8">
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <h4 className="text-2xl font-black text-slate-900">{ventana.nombre}</h4>
                          <Badge className="bg-emerald-500 text-white animate-pulse border-none">ABIERTA</Badge>
                          {getBadgeEstadoTurno(ventana.atencionEstado)}
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu Posición</p>
                            <p className="text-4xl font-black text-unt-blue">#{ventana.posicionCola}</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Turno Actual</p>
                            <p className="text-4xl font-black text-slate-700">#{ventana.turnoActual}</p>
                          </div>
                        </div>
                        {ventana.atencionEstado !== 'AUSENTE' && (
                          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <Clock className="h-5 w-5 text-amber-600" />
                            <p className="text-sm font-bold text-amber-800">
                              Estimación: Aprox. {Math.max(0, ventana.posicionCola - (ventana.turnoActual || 0)) * 15} minutos para tu turno
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="w-full md:w-auto flex flex-col gap-3">
                        {ventana.atencionEstado === 'AUSENTE' ? (
                          <div className="rounded-xl bg-amber-50 dark:bg-slate-700/50 border border-amber-200 dark:border-slate-600 p-4 text-xs font-bold text-amber-800 dark:text-amber-300 max-w-sm">
                            Tu justificación fue registrada. El operador puede reprogramar tu turno.
                          </div>
                        ) : (
                          <>
                            <Boton 
                              variant="outline" 
                              className="border-amber-200 text-amber-700 hover:bg-amber-50"
                              onClick={() => setShowJustifyModal(true)}
                              disabled={justified}
                            >
                              {justified ? 'Ausencia justificada' : 'Justificar ausencia'}
                            </Boton>
                            <p className="text-[10px] text-center text-slate-500 max-w-[200px]">
                              Mantente disponible, te notificaremos cuando sea tu turno
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {ventana.posicionCola === ventana.turnoActual && (ventana.estado === 'ABIERTA' || ventana.estado === 'EN_CURSO') && (
                  <Card className="border-emerald-200 bg-emerald-50/50 p-8 ring-4 ring-emerald-500/20 animate-pulse">
                    <div className="text-center space-y-6">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                        <Timer className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-4xl font-black text-emerald-900 tracking-tight">🎯 ¡ES TU TURNO!</h3>
                        <p className="text-emerald-700 font-bold">Tienes 15 minutos para seleccionar tu horario</p>
                      </div>
                      
                      <div className="bg-white rounded-3xl p-6 shadow-xl inline-block border-2 border-emerald-100">
                        <p className={cn(
                          "text-6xl font-black tabular-nums tracking-tighter",
                          timeLeft < 180 ? "text-rose-600 animate-bounce" : "text-slate-900"
                        )}>
                          {formatTime(timeLeft)}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-4">
                        <Link 
                          href="/dashboard/horarios/seleccion"
                          className="btn-primary bg-emerald-600 hover:bg-emerald-700 px-12 py-4 text-lg shadow-xl shadow-emerald-200 flex items-center gap-3"
                        >
                          Seleccionar horario ahora <ArrowRight className="h-5 w-5" />
                        </Link>
                        <Boton variant="ghost" className="text-slate-500" onClick={() => setShowJustifyModal(true)}>
                          Justificar ausencia
                        </Boton>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Card className="p-4 border-slate-100 bg-slate-50/50 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <ShieldCheck className="h-6 w-6 text-unt-blue" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Categoría</p>
                        <p className="text-sm font-bold text-slate-900">{ventana.categoriaDocente || 'Docente Ordinario'}</p>
                      </div>
                   </Card>
                   <Card className="p-4 border-slate-100 bg-slate-50/50 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <FileText className="h-6 w-6 text-unt-blue" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Antigüedad</p>
                        <p className="text-sm font-bold text-slate-900">{calcularAntiguedad(ventana.fechaIngresoDocente)}</p>
                      </div>
                   </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notificaciones' && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                 <h3 className="text-xl font-bold">Notificaciones</h3>
                 {unreadCount > 0 && <Badge className="bg-rose-100 text-rose-600 border-none">{unreadCount} nuevas</Badge>}
              </div>
              <Boton variant="ghost" size="sm" onClick={handleMarcarTodasLeidas} className="text-unt-blue font-bold">
                Marcar todas como leídas
              </Boton>
            </div>

            <div className="space-y-3">
              {notificaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <MessageSquare className="h-12 w-12 opacity-20 mb-4" />
                  <p className="font-bold">No tienes notificaciones aún</p>
                </div>
              ) : (
                notificaciones.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => handleLeerNotificacion(notif.id)}
                    className={cn(
                      "group relative p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md",
                      notif.estado !== 'LEIDA' 
                        ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800" 
                        : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                    )}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-700 shadow-sm">
                        {NOTIF_ICONS[notif.tipo] || <Bell className="h-4 w-4 text-slate-400 dark:text-slate-300" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className={cn("text-sm font-bold", notif.estado !== 'LEIDA' ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400")}>
                            {notif.titulo}
                          </h5>
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                            {new Date(notif.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{notif.mensaje}</p>
                        
                        {notif.tipo === 'TURNO' && (
                          <Link href="/dashboard/horarios/seleccion" className="inline-flex items-center gap-2 mt-3 text-[11px] font-black text-unt-blue uppercase tracking-widest hover:underline">
                            Ir ahora <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                      {notif.estado !== 'LEIDA' && (
                        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-unt-blue" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <Modal open={showJustifyModal} onOpenChange={setShowJustifyModal}>
        <ModalContent className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
          <ModalHeader>
            <ModalTitle className="text-slate-900 dark:text-white text-xl font-bold">Justificar ausencia</ModalTitle>
            <ModalDescription className="text-slate-500 dark:text-slate-400 text-sm mt-1">Si no puedes asistir a seleccionar tu horario, registra tu justificación.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                  Importante: Límite de 2 horas
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Debes justificar tu ausencia al menos 2 horas antes del inicio estimado de tu turno.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Tipo de ausencia</label>
              <select 
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-4 py-3 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={justifyForm.tipo}
                onChange={(e) => setJustifyForm({...justifyForm, tipo: e.target.value})}
              >
                <option value="">Selecciona una opción</option>
                <option value="ENFERMEDAD">Enfermedad</option>
                <option value="COMISION">Comisión de servicios</option>
                <option value="EMERGENCIA">Emergencia familiar</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Motivo (min. 20 caracteres)</label>
              <textarea 
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-4 py-3 w-full min-h-[120px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
                placeholder="Describe el motivo de tu ausencia..."
                value={justifyForm.motivo}
                onChange={(e) => setJustifyForm({...justifyForm, motivo: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">N° de documento (opcional)</label>
              <input 
                type="text"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-4 py-3 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="Ej: Certificado médico N° 12345"
                value={justifyForm.documento}
                onChange={(e) => setJustifyForm({...justifyForm, documento: e.target.value})}
              />
            </div>
          </div>
          <ModalFooter>
            <Boton variant="ghost" onClick={() => setShowJustifyModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</Boton>
            <Boton 
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              disabled={!justifyForm.tipo || justifyForm.motivo.length < 20 || justifying}
              onClick={handleJustificar}
            >
              {justifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Enviar justificación'}
            </Boton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {justified && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-500 p-4 text-white shadow-2xl">
            <CheckCircle2 className="h-6 w-6" />
            <div>
              <p className="font-bold">Ausencia justificada</p>
              <p className="text-[10px] opacity-80 uppercase font-black">El administrador fue notificado</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
