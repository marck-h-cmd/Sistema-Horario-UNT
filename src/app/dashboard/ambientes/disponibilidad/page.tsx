'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePeriodo } from '@/contexts/PeriodoContext';
import { Rol } from '@prisma/client';
import { 
  Building2, 
  Calendar as CalendarIcon, 
  Search, 
  Users, 
  CheckCircle2, 
  X, 
  Loader2, 
  AlertTriangle, 
  Clock, 
  Info,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { apiGet, ApiClientError } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface HorarioSimplificado {
  id: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  curso: { codigo: string; nombre: string } | null;
  docente: string | null;
  grupo: string | null;
}

interface MantenimientoSimplificado {
  id: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
}

interface AmbienteDisponibilidad {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  capacidad: number;
  ubicacion: string | null;
  horarios: HorarioSimplificado[];
  mantenimientos: MantenimientoSimplificado[];
}

interface ApiResponse {
  diaSemana: string;
  fecha: string;
  ambientes: AmbienteDisponibilidad[];
}

interface Slot {
  label: string;
  start: string;
  end: string;
}

const ALL_SLOTS: Slot[] = [
  { label: '07:00 - 08:00', start: '07:00', end: '08:00' },
  { label: '08:00 - 09:00', start: '08:00', end: '09:00' },
  { label: '09:00 - 10:00', start: '09:00', end: '10:00' },
  { label: '10:00 - 11:00', start: '10:00', end: '11:00' },
  { label: '11:00 - 12:00', start: '11:00', end: '12:00' },
  { label: '12:00 - 13:00', start: '12:00', end: '13:00' },
  { label: '13:00 - 14:00', start: '13:00', end: '14:00' },
  { label: '14:00 - 15:00', start: '14:00', end: '15:00' },
  { label: '15:00 - 16:00', start: '15:00', end: '16:00' },
  { label: '16:00 - 17:00', start: '16:00', end: '17:00' },
  { label: '17:00 - 18:00', start: '17:00', end: '18:00' },
  { label: '18:00 - 19:00', start: '18:00', end: '19:00' },
  { label: '19:00 - 20:00', start: '19:00', end: '20:00' },
  { label: '20:00 - 21:00', start: '20:00', end: '21:00' },
  { label: '21:00 - 22:00', start: '21:00', end: '22:00' },
];

const TURNO_SLOTS: Record<string, { start: string; end: string }> = {
  MAÑANA: { start: '07:00', end: '13:00' },
  TARDE: { start: '13:00', end: '18:00' },
  NOCHE: { start: '18:00', end: '22:00' },
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function checkOverlap(slotStart: string, slotEnd: string, start: string, end: string): boolean {
  return Math.max(timeToMinutes(slotStart), timeToMinutes(start)) < Math.min(timeToMinutes(slotEnd), timeToMinutes(end));
}

export default function DisponibilidadPage() {
  const { loading: authLoading } = useRequireAuth([Rol.ADMINISTRADOR, Rol.SECRETARIA]);
  const { periodoSeleccionado } = usePeriodo();
  const periodoId = periodoSeleccionado?.id;

  // Estados de filtros
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tipo, setTipo] = useState<string>('TODOS');
  const [edificio, setEdificio] = useState<string>('');
  const [turno, setTurno] = useState<string>('TODOS');
  const [buscar, setBuscar] = useState<string>('');

  // Estados de datos
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Estados de modal de detalle
  const [selectedCell, setSelectedCell] = useState<{
    ambiente: AmbienteDisponibilidad;
    slot: Slot;
    horario?: HorarioSimplificado;
    mantenimiento?: MantenimientoSimplificado;
  } | null>(null);

  const [selectedAmbiente, setSelectedAmbiente] = useState<AmbienteDisponibilidad | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Carga de datos
  const fetchDisponibilidad = async () => {
    if (!periodoId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: any = { periodoId, fecha };
      if (tipo && tipo !== 'TODOS') params.tipo = tipo;
      if (edificio) params.edificio = edificio;

      const res = await apiGet<ApiResponse>('/api/horarios/disponibilidad-ambientes', params);
      if (res.data) {
        setData(res.data);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof ApiClientError ? e.message : 'Error al cargar la disponibilidad');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisponibilidad();
  }, [periodoId, fecha, tipo, edificio]);

  // Conexión WebSockets para actualizaciones en tiempo real
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/websocket?token=${encodeURIComponent(token)}&channel=general`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          // Refrescar si hay cambios en horarios
          if (
            msg.type === 'actividad' || 
            msg.type?.startsWith('horario:')
          ) {
            fetchDisponibilidad();
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };
    } catch (e) {
      console.error('WS Connection error:', e);
    }

    return () => {
      wsRef.current?.close();
    };
  }, [periodoId, fecha]);

  // Filtrar slots por turno en frontend
  const slots = useMemo(() => {
    if (turno === 'TODOS') return ALL_SLOTS;
    const range = TURNO_SLOTS[turno];
    if (!range) return ALL_SLOTS;

    return ALL_SLOTS.filter(slot => {
      const slotStartMin = timeToMinutes(slot.start);
      const slotEndMin = timeToMinutes(slot.end);
      const rangeStartMin = timeToMinutes(range.start);
      const rangeEndMin = timeToMinutes(range.end);
      return slotStartMin >= rangeStartMin && slotEndMin <= rangeEndMin;
    });
  }, [turno]);

  // Filtrar ambientes por buscador
  const ambientesFiltrados = useMemo(() => {
    if (!data?.ambientes) return [];
    if (!buscar.trim()) return data.ambientes;
    const q = buscar.toLowerCase();
    return data.ambientes.filter(
      amb => 
        amb.codigo.toLowerCase().includes(q) || 
        amb.nombre.toLowerCase().includes(q) ||
        (amb.ubicacion && amb.ubicacion.toLowerCase().includes(q))
    );
  }, [data, buscar]);

  // Auxiliar para determinar estado de una celda
  const getCellState = (ambiente: AmbienteDisponibilidad, slot: Slot) => {
    // 1. Verificar mantenimiento
    const mantenimiento = ambiente.mantenimientos?.find(m => {
      // Extraer horas de los campos fechaInicio/fechaFin
      const mStart = new Date(m.fechaInicio).toTimeString().slice(0, 5);
      const mEnd = new Date(m.fechaFin).toTimeString().slice(0, 5);
      return checkOverlap(slot.start, slot.end, mStart, mEnd);
    });

    if (mantenimiento) {
      return { type: 'MAINTENANCE' as const, mantenimiento };
    }

    // 2. Verificar horarios
    const horario = ambiente.horarios?.find(h => {
      if (!h.horaInicio || !h.horaFin) return false;
      return checkOverlap(slot.start, slot.end, h.horaInicio, h.horaFin);
    });

    if (horario) {
      const isReserved = horario.estado === 'BORRADOR' || horario.estado === 'SELECCION_TEMPORAL';
      return { 
        type: isReserved ? ('RESERVED' as const) : ('OCCUPIED' as const), 
        horario 
      };
    }

    return { type: 'AVAILABLE' as const };
  };

  // Cambiar fecha en un día
  const adjustDate = (days: number) => {
    const d = new Date(fecha);
    d.setDate(d.getDate() + days);
    setFecha(d.toISOString().split('T')[0]);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1a365d] tracking-tight">Disponibilidad en Vivo</h1>
          <p className="text-slate-500 mt-1">
            Agenda interactiva en tiempo real para todos los ambientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full shadow-sm text-xs font-semibold">
            <div className={cn(
              "w-2 h-2 rounded-full",
              wsConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )} />
            <span className="text-slate-600 dark:text-slate-300">
              {wsConnected ? 'Conexión en vivo' : 'Sin conexión'}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDisponibilidad}
            className="border-slate-200 hover:bg-slate-100"
          >
            Refrescar
          </Button>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          {/* Navegación y Fecha */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => adjustDate(-1)}
              className="h-10 w-10 border-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="pl-10 pr-3 py-2 border rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-unt-blue/20"
              />
              <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => adjustDate(1)}
              className="h-10 w-10 border-slate-200 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFecha(new Date().toISOString().split('T')[0])}
              className="text-unt-blue hover:underline text-xs font-bold"
            >
              Ir a Hoy
            </Button>
          </div>

          {/* Filtros de Ambientes */}
          <div className="flex flex-wrap items-center gap-3 flex-1 lg:justify-end">
            {/* Buscador */}
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <Input
                type="text"
                placeholder="Buscar ambiente..."
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                className="pl-9 bg-white text-sm"
              />
            </div>

            {/* Tipo */}
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-unt-blue/20"
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="AULA">Aulas</option>
              <option value="LABORATORIO">Laboratorios</option>
              <option value="ESPECIALES">Espacios Especiales</option>
            </select>

            {/* Pabellón */}
            <Input
              type="text"
              placeholder="Pabellón / Ubicación..."
              value={edificio}
              onChange={e => setEdificio(e.target.value)}
              className="max-w-[160px] bg-white text-sm"
            />

            {/* Turno */}
            <select
              value={turno}
              onChange={e => setTurno(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-unt-blue/20 font-semibold"
            >
              <option value="TODOS">Todo el día</option>
              <option value="MAÑANA">Mañana (7am - 1pm)</option>
              <option value="TARDE">Tarde (1pm - 6pm)</option>
              <option value="NOCHE">Noche (6pm - 10pm)</option>
            </select>
          </div>
        </div>

        {/* LEYENDA */}
        <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500 shadow-sm"></span>
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-500 shadow-sm"></span>
            <span>Ocupado (Confirmado/Publicado)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500 shadow-sm"></span>
            <span>Reservado (Borrador)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-400 shadow-sm"></span>
            <span>En Mantenimiento</span>
          </div>
          {data && (
            <div className="ml-auto text-slate-400">
              Día consultado: <span className="text-slate-800 dark:text-white font-bold">{data.diaSemana}</span>
            </div>
          )}
        </div>
      </div>

      {/* GRID DE DISPONIBILIDAD */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchDisponibilidad} className="ml-auto text-red-700 hover:bg-red-100 font-bold">
            Reintentar
          </Button>
        </div>
      )}

      {!periodoId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
          Por favor, seleccione un período académico en la barra de navegación superior.
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-unt-blue" />
          <span className="text-sm font-semibold text-slate-500 animate-pulse">Cargando disponibilidad de ambientes…</span>
        </div>
      ) : ambientesFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 shadow-sm flex flex-col items-center gap-3">
          <Building2 className="w-12 h-12 text-slate-300" />
          <p className="font-semibold text-lg text-slate-700 dark:text-slate-300">No se encontraron ambientes</p>
          <p className="text-sm text-slate-400 max-w-sm">Prueba ajustando los filtros de tipo de ambiente, pabellón o el buscador.</p>
        </div>
      ) : (
        <div className="shadow-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="overflow-x-auto max-h-[68vh] scrollbar-thin">
            <table className="w-auto min-w-full text-sm text-left border-collapse select-none">
              <thead className="bg-[#1a365d] text-white sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-[#1a365d] border-r border-b border-slate-700 px-4 py-4 text-center font-bold w-28 shadow-sm">
                    HORA
                  </th>
                  {ambientesFiltrados.map(amb => (
                    <th 
                      key={amb.id} 
                      onClick={() => setSelectedAmbiente(amb)}
                      className="border-b border-r border-slate-700 px-4 py-3 text-center font-bold min-w-[155px] hover:bg-[#2c5282] transition-colors cursor-pointer"
                    >
                      <div className="truncate text-sm font-extrabold uppercase">{amb.codigo}</div>
                      <div className="truncate text-[10px] text-blue-200 font-medium tracking-wide mt-0.5">{amb.nombre}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {slots.map((slot, rowIndex) => (
                  <tr 
                    key={slot.start} 
                    className={cn(
                      "h-14 transition-colors",
                      rowIndex % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/20 dark:bg-slate-800/40"
                    )}
                  >
                    {/* Hora sticky left */}
                    <td className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-700 px-2 py-3 text-center font-bold font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap shadow-sm">
                      {slot.start}
                      <span className="block text-[10px] text-slate-400 font-normal leading-none mt-1">{slot.end}</span>
                    </td>

                    {/* Celdas de Ambientes */}
                    {ambientesFiltrados.map(amb => {
                      const state = getCellState(amb, slot);
                      
                      let bgClass = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20";
                      let indicatorColor = "bg-emerald-500";
                      let title = "Disponible";

                      if (state.type === 'OCCUPIED') {
                        bgClass = "bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer";
                        indicatorColor = "bg-rose-500";
                        title = `${state.horario?.curso?.codigo} - ${state.horario?.curso?.nombre}`;
                      } else if (state.type === 'RESERVED') {
                        bgClass = "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer";
                        indicatorColor = "bg-amber-500";
                        title = `Reservado: ${state.horario?.curso?.codigo}`;
                      } else if (state.type === 'MAINTENANCE') {
                        bgClass = "bg-slate-400/10 text-slate-600 dark:text-slate-400 hover:bg-slate-400/20 cursor-pointer border-slate-300";
                        indicatorColor = "bg-slate-400";
                        title = `Mantenimiento: ${state.mantenimiento?.descripcion}`;
                      }

                      return (
                        <td
                          key={amb.id}
                          title={title}
                          onClick={() => {
                            if (state.type !== 'AVAILABLE') {
                              setSelectedCell({
                                ambiente: amb,
                                slot,
                                horario: state.horario,
                                mantenimiento: state.mantenimiento
                              });
                            }
                          }}
                          className={cn(
                            "border-r border-b border-slate-200/60 dark:border-slate-700 p-1.5 transition-all text-xs font-semibold relative select-none",
                            bgClass
                          )}
                        >
                          <div className="flex items-center gap-1.5 justify-center w-full h-full min-h-[30px] rounded-md">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", indicatorColor)}></span>
                            {state.type === 'OCCUPIED' && (
                              <span className="truncate max-w-[100px] leading-tight font-extrabold">
                                {state.horario?.curso?.codigo}
                              </span>
                            )}
                            {state.type === 'RESERVED' && (
                              <span className="truncate max-w-[100px] leading-tight font-bold italic">
                                {state.horario?.curso?.codigo}
                              </span>
                            )}
                            {state.type === 'MAINTENANCE' && (
                              <span className="truncate max-w-[100px] leading-tight font-medium text-[10px]">
                                Mantenimiento
                              </span>
                            )}
                            {state.type === 'AVAILABLE' && (
                              <span className="opacity-0 group-hover:opacity-100 font-normal text-[10px] text-emerald-600">
                                Libre
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIALOG DETALLE CELDA OCUPADA / RESERVADA / MANTENIMIENTO */}
      <Dialog open={!!selectedCell} onOpenChange={open => !open && setSelectedCell(null)}>
        {selectedCell && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#1a365d]">
                <Clock className="w-5 h-5" />
                Detalle del Horario
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>AMBIENTE</span>
                  <Badge variant="outline" className="font-extrabold">{selectedCell.ambiente.tipo}</Badge>
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {selectedCell.ambiente.codigo} — {selectedCell.ambiente.nombre}
                </div>
                {selectedCell.ambiente.ubicacion && (
                  <div className="text-xs text-slate-500 font-medium">
                    Ubicación: {selectedCell.ambiente.ubicacion}
                  </div>
                )}
                <div className="text-xs text-slate-500 font-medium">
                  Capacidad: <strong>{selectedCell.ambiente.capacidad} personas</strong>
                </div>
              </div>

              {selectedCell.horario && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Curso / Asignatura</span>
                    <Badge variant={selectedCell.horario.estado === 'PUBLICADO' || selectedCell.horario.estado === 'CONFIRMADO' ? 'success' : 'warning'}>
                      {selectedCell.horario.estado}
                    </Badge>
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    [{selectedCell.horario.curso?.codigo}] {selectedCell.horario.curso?.nombre}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div>
                      <div className="text-xs text-slate-400">DOCENTE</div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                        {selectedCell.horario.docente || 'Sin docente asignado'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">GRUPO</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                        Grupo {selectedCell.horario.grupo || 'Único'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="text-xs text-slate-400">HORARIO PLANIFICADO</div>
                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                      {selectedCell.slot.label} (Efectivo: {selectedCell.horario.horaInicio} - {selectedCell.horario.horaFin})
                    </div>
                  </div>
                </div>
              )}

              {selectedCell.mantenimiento && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Mantenimiento de Ambiente</span>
                    <Badge variant="destructive">Bloqueado</Badge>
                  </div>
                  <div className="text-sm font-bold text-red-700 bg-red-50 dark:bg-red-950/20 dark:text-red-300 p-3 rounded-lg border border-red-100 dark:border-red-900/40">
                    {selectedCell.mantenimiento.descripcion}
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="text-xs text-slate-400">FRANJA DE BLOQUEO</div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                      Desde: {new Date(selectedCell.mantenimiento.fechaInicio).toLocaleString()}<br />
                      Hasta: {new Date(selectedCell.mantenimiento.fechaFin).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedCell(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* DIALOG CRONOGRAMA COMPLETO DEL AMBIENTE */}
      <Dialog open={!!selectedAmbiente} onOpenChange={open => !open && setSelectedAmbiente(null)}>
        {selectedAmbiente && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#1a365d]">
                <Building2 className="w-5 h-5" />
                Cronograma de {selectedAmbiente.codigo} ({selectedAmbiente.tipo})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="text-sm text-slate-500 font-medium">
                Cronograma de reservas para el día consultado en el ambiente: <strong className="text-slate-900 dark:text-white">{selectedAmbiente.nombre}</strong>.
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm bg-slate-50 dark:bg-slate-900/20">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Horario</th>
                      <th className="px-4 py-3">Asignatura</th>
                      <th className="px-4 py-3">Docente</th>
                      <th className="px-4 py-3">Grupo</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                    {selectedAmbiente.horarios.length === 0 && selectedAmbiente.mantenimientos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                          No hay sesiones programadas ni mantenimientos para este día.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {selectedAmbiente.horarios.map(h => (
                          <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-mono font-bold text-[#1a365d] dark:text-blue-400">{h.horaInicio} - {h.horaFin}</td>
                            <td className="px-4 py-3 font-semibold">
                              [{h.curso?.codigo}] {h.curso?.nombre}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{h.docente || 'Sin docente'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Grupo {h.grupo || 'Único'}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant={h.estado === 'PUBLICADO' || h.estado === 'CONFIRMADO' ? 'success' : 'warning'}>
                                {h.estado}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {selectedAmbiente.mantenimientos.map(m => {
                          const mStart = new Date(m.fechaInicio).toTimeString().slice(0, 5);
                          const mEnd = new Date(m.fechaFin).toTimeString().slice(0, 5);
                          return (
                            <tr key={m.id} className="bg-red-50/20 dark:bg-red-950/10 text-red-900 dark:text-red-400 font-medium">
                              <td className="px-4 py-3 font-mono font-bold">{mStart} - {mEnd}</td>
                              <td colSpan={3} className="px-4 py-3 italic">
                                BLOQUEADO POR MANTENIMIENTO: {m.descripcion}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant="destructive">Bloqueado</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedAmbiente(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
