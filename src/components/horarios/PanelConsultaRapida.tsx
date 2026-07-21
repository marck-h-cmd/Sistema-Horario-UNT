'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, Calendar, Clock, MapPin, CheckCircle, XCircle, User, BookOpen, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIAS_LABEL: Record<string, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado',
};

const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

interface Ambiente {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  capacidad: number;
}

interface HorarioItem {
  id: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  ambienteId: string;
  ambiente?: { id: string; codigo: string; nombre: string; tipo: string };
  docente?: { id: string; usuario?: { nombre: string; apellidos: string }; nombre?: string; apellidos?: string };
  curso?: { id: string; codigo: string; nombre: string };
  grupo?: { id: string; nombre: string };
}

interface PanelConsultaRapidaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodoId?: string;
}

export function PanelConsultaRapida({ open, onOpenChange, periodoId }: PanelConsultaRapidaProps) {
  const [activeTab, setActiveTab] = useState<'RECURSOS' | 'FRANJA' | 'DOCENTE' | 'MATRIZ_LABS'>('RECURSOS');
  const [loading, setLoading] = useState(false);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);

  // Filtros de búsqueda
  const [busquedaAmbiente, setBusquedaAmbiente] = useState('');
  const [selectedDia, setSelectedDia] = useState<string>('LUNES');
  const [selectedHora, setSelectedHora] = useState<string>('08:00');
  const [selectedDocenteId, setSelectedDocenteId] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'AULA' | 'LABORATORIO'>('TODOS');

  // Cargar datos al abrir
  useEffect(() => {
    if (!open || !periodoId) return;

    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/ambientes?limit=200`, { headers }).then(r => r.json()),
      fetch(`/api/horarios?periodoId=${periodoId}&limit=1000`, { headers }).then(r => r.json()),
      fetch(`/api/docentes?limit=200`, { headers }).then(r => r.json()),
    ])
      .then(([ambRes, horRes, docRes]) => {
        setAmbientes(ambRes.data ?? []);
        setHorarios(horRes.data?.items ?? horRes.data ?? []);
        setDocentes((docRes.data ?? []).map((d: any) => ({
          id: d.id,
          nombreCompleto: d.usuario ? `${d.usuario.apellidos}, ${d.usuario.nombre}` : `${d.apellidos ?? ''}, ${d.nombre ?? ''}`,
          codigo: d.codigo,
        })));
        if (docRes.data?.[0]?.id) setSelectedDocenteId(docRes.data[0].id);
      })
      .catch((err) => console.error('Error al cargar consulta rápida:', err))
      .finally(() => setLoading(false));
  }, [open, periodoId]);

  // Mapa de ocupación por ambiente (ambienteId -> dia -> hora -> horarioItem)
  const mapaOcupacion = useMemo(() => {
    const mapa: Record<string, Record<string, Record<string, HorarioItem>>> = {};
    horarios.forEach((h) => {
      if (!h.ambienteId) return;
      if (!mapa[h.ambienteId]) mapa[h.ambienteId] = {};
      if (!mapa[h.ambienteId][h.diaSemana]) mapa[h.ambienteId][h.diaSemana] = {};

      const startH = parseInt(h.horaInicio.split(':')[0], 10);
      const endH = parseInt(h.horaFin.split(':')[0], 10);

      for (let hr = startH; hr < endH; hr++) {
        const keyHora = `${String(hr).padStart(2, '0')}:00`;
        mapa[h.ambienteId][h.diaSemana][keyHora] = h;
      }
    });
    return mapa;
  }, [horarios]);

  // Lista filtrada de ambientes
  const ambientesFiltrados = useMemo(() => {
    return ambientes.filter((a) => {
      const matchTipo = tipoFiltro === 'TODOS' || a.tipo === tipoFiltro;
      const q = busquedaAmbiente.trim().toLowerCase();
      const matchQuery = !q || a.codigo.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q);
      return matchTipo && matchQuery;
    });
  }, [ambientes, tipoFiltro, busquedaAmbiente]);

  // Obtener estado de un ambiente en un día y hora específico
  const getEstadoAmbiente = (ambienteId: string, dia: string, hora: string) => {
    const h = mapaOcupacion[ambienteId]?.[dia]?.[hora];
    if (h) {
      const docenteNombre = h.docente?.usuario 
        ? `${h.docente.usuario.apellidos}` 
        : (h.docente?.apellidos || 'Docente asignado');
      const cursoNombre = h.curso?.nombre || 'Curso libre';
      return { ocupado: true, item: h, label: `${cursoNombre} (${docenteNombre})` };
    }
    return { ocupado: false, item: null, label: 'Disponible' };
  };

  // Franja seleccionada: Ambientes libres y ocupados
  const franjaResumen = useMemo(() => {
    const libres: Ambiente[] = [];
    const ocupados: { ambiente: Ambiente; info: string; item: HorarioItem }[] = [];

    ambientesFiltrados.forEach((a) => {
      const st = getEstadoAmbiente(a.id, selectedDia, selectedHora);
      if (st.ocupado && st.item) {
        ocupados.push({ ambiente: a, info: st.label, item: st.item });
      } else {
        libres.push(a);
      }
    });

    return { libres, ocupados };
  }, [ambientesFiltrados, selectedDia, selectedHora, mapaOcupacion]);

  // Docente seleccionado: Horarios asignados
  const docenteHorarios = useMemo(() => {
    if (!selectedDocenteId) return [];
    return horarios.filter((h) => h.docente?.id === selectedDocenteId);
  }, [selectedDocenteId, horarios]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30 text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                Consulta Rápida de Disponibilidad (Secretaría)
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Pestañas superiores */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 gap-2 pt-2">
          {[
            { id: 'RECURSOS', label: 'Buscador de Aulas/Labs', icon: MapPin },
            { id: 'FRANJA', label: '¿Qué está libre ahora/franja?', icon: Clock },
            { id: 'DOCENTE', label: 'Disponibilidad de Docente', icon: User },
            { id: 'MATRIZ_LABS', label: 'Matriz Ocupación Laboratorios', icon: Layers },
          ].map((t) => {
            const Icon = t.icon;
            const isAct = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-t border-x transition-all',
                  isAct
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-700 border-b-white dark:border-b-slate-800 shadow-sm'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Cuerpo dinámico */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/20">
          {loading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Cargando disponibilidad en tiempo real…</span>
            </div>
          ) : (
            <>
              {/* TAB 1: BUSCADOR DE AULAS / LABS */}
              {activeTab === 'RECURSOS' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={busquedaAmbiente}
                        onChange={(e) => setBusquedaAmbiente(e.target.value)}
                        placeholder="Buscar espacio por nombre o código (ej. Lab 2, Aula 301)…"
                        className="pl-9 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg text-xs">
                      {(['TODOS', 'AULA', 'LABORATORIO'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTipoFiltro(t)}
                          className={cn(
                            'px-3 py-1.5 rounded-md font-medium transition-colors',
                            tipoFiltro === t ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
                          )}
                        >
                          {t === 'TODOS' ? 'Todos' : t === 'AULA' ? 'Aulas' : 'Laboratorios'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ambientesFiltrados.map((amb) => {
                      const ahora = new Date();
                      const diaActualIndex = ahora.getDay() === 0 ? 5 : ahora.getDay() - 1;
                      const diaActualKey = DIAS[diaActualIndex] || 'LUNES';
                      const horaActualStr = `${String(ahora.getHours()).padStart(2, '0')}:00`;
                      const stateNow = getEstadoAmbiente(amb.id, diaActualKey, horaActualStr);

                      return (
                        <div key={amb.id} className="card p-4 hover:border-blue-300 transition-all shadow-sm bg-white dark:bg-slate-800">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white text-base font-mono">{amb.codigo}</span>
                              <p className="text-xs text-slate-500 truncate max-w-[180px]">{amb.nombre}</p>
                            </div>
                            <Badge variant={amb.tipo === 'LABORATORIO' ? 'purple' : 'neutral'}>
                              {amb.tipo}
                            </Badge>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                            <span className="text-slate-500">Capacidad: <b className="text-slate-700 dark:text-slate-300">{amb.capacidad} pers.</b></span>
                            {stateNow.ocupado ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-semibold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded text-[11px]">
                                <XCircle className="w-3.5 h-3.5" /> Ocupado ahora
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded text-[11px]">
                                <CheckCircle className="w-3.5 h-3.5" /> Libre ahora
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: FRANJA HORARIA */}
              {activeTab === 'FRANJA' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Día de la semana</label>
                      <select
                        value={selectedDia}
                        onChange={(e) => setSelectedDia(e.target.value)}
                        className="input h-9 text-xs dark:bg-slate-700"
                      >
                        {DIAS.map((d) => (
                          <option key={d} value={d}>{DIAS_LABEL[d]}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Hora Inicio</label>
                      <select
                        value={selectedHora}
                        onChange={(e) => setSelectedHora(e.target.value)}
                        className="input h-9 text-xs dark:bg-slate-700"
                      >
                        {HORAS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div className="ml-auto text-right text-xs">
                      <span className="text-slate-500">Resultados para:</span>
                      <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                        {DIAS_LABEL[selectedDia]} a las {selectedHora}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LIBRES */}
                    <div className="card p-4 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10">
                      <h4 className="font-semibold text-emerald-800 dark:text-emerald-400 text-sm flex items-center gap-2 mb-3">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        Aulas y Laboratorios LIBRES ({franjaResumen.libres.length})
                      </h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {franjaResumen.libres.map((a) => (
                          <div key={a.id} className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-xs">
                            <div>
                              <span className="font-bold font-mono text-slate-900 dark:text-white">{a.codigo}</span>
                              <span className="ml-2 text-slate-500">{a.nombre}</span>
                            </div>
                            <Badge variant="success">Disponible</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* OCUPADOS */}
                    <div className="card p-4 border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10">
                      <h4 className="font-semibold text-red-800 dark:text-red-400 text-sm flex items-center gap-2 mb-3">
                        <XCircle className="h-4 w-4 text-red-600" />
                        Espacios OCUPADOS ({franjaResumen.ocupados.length})
                      </h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {franjaResumen.ocupados.map((item) => (
                          <div key={item.ambiente.id} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-red-100 dark:border-red-900/30 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold font-mono text-slate-900 dark:text-white">{item.ambiente.codigo}</span>
                              <Badge variant="danger">Ocupado</Badge>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 font-medium">{item.info}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DOCENTE */}
              {activeTab === 'DOCENTE' && (
                <div className="space-y-4">
                  <div className="max-w-md">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Seleccionar Docente</label>
                    <select
                      value={selectedDocenteId}
                      onChange={(e) => setSelectedDocenteId(e.target.value)}
                      className="input h-10 text-xs dark:bg-slate-800"
                    >
                      {docentes.map((d) => (
                        <option key={d.id} value={d.id}>{d.codigo} — {d.nombreCompleto}</option>
                      ))}
                    </select>
                  </div>

                  <div className="card p-4 bg-white dark:bg-slate-800">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-3">
                      Horarios Programados para el Docente ({docenteHorarios.length} franjas)
                    </h4>

                    {docenteHorarios.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">Este docente no tiene franjas ocupadas en el período actual (está totalmente disponible).</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                              <th className="p-2">Día</th>
                              <th className="p-2">Horario</th>
                              <th className="p-2">Asignatura</th>
                              <th className="p-2">Ambiente</th>
                            </tr>
                          </thead>
                          <tbody>
                            {docenteHorarios.map((h) => (
                              <tr key={h.id} className="border-b border-slate-100 dark:border-slate-800">
                                <td className="p-2 font-semibold text-blue-600">{DIAS_LABEL[h.diaSemana]}</td>
                                <td className="p-2 font-mono">{h.horaInicio} - {h.horaFin}</td>
                                <td className="p-2 font-medium">{h.curso?.nombre ?? 'Curso'}</td>
                                <td className="p-2 font-mono">{h.ambiente?.codigo ?? 'Aula'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: MATRIZ DE LABORATORIOS */}
              {activeTab === 'MATRIZ_LABS' && (
                <div className="space-y-4">
                  <div className="overflow-x-auto card p-3 bg-white dark:bg-slate-800">
                    <table className="w-full text-[11px] border-collapse min-w-[700px]">
                      <thead>
                        <tr>
                          <th className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 w-24">Laboratorio</th>
                          {DIAS.map((d) => (
                            <th key={d} className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-center font-semibold">
                              {DIAS_LABEL[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ambientesFiltrados
                          .filter((a) => a.tipo === 'LABORATORIO')
                          .map((lab) => (
                            <tr key={lab.id}>
                              <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold font-mono bg-slate-50 dark:bg-slate-900/50">
                                {lab.codigo}
                              </td>
                              {DIAS.map((dia) => {
                                const ocupados = HORAS.filter((h) => getEstadoAmbiente(lab.id, dia, h).ocupado);
                                const total = HORAS.length;
                                const ratio = ocupados.length / total;

                                return (
                                  <td key={dia} className="p-2 border border-slate-200 dark:border-slate-700 text-center">
                                    {ocupados.length === 0 ? (
                                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-semibold">
                                        100% Libre
                                      </span>
                                    ) : ratio > 0.6 ? (
                                      <span className="inline-block px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 font-semibold">
                                        {ocupados.length} hrs ocup.
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold">
                                        {ocupados.length} hrs ocup.
                                      </span>
                                    )}
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
