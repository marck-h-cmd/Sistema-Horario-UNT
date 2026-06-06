'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Plus, Trash2, Save, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, ApiClientError, downloadFile } from '@/lib/api-client';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIAS_LABEL: Record<string, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado',
};

// Generador de horas de 07:00 a 20:00
const HORAS: string[] = [];
for (let i = 7; i <= 20; i++) {
  HORAS.push(`${i.toString().padStart(2, '0')}:00`);
}

function hourStrToInt(time: string): number {
  return Number(time.split(':')[0]);
}

function intToHourStr(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`;
}

interface Props {
  docenteId: string;
  periodoId: string;
  declaracionItems: any[]; // items de declaración ya guardados
  horariosLectivos: any[]; // para mostrar como read-only
}

export default function PanelDistribucionHoraria({ docenteId, periodoId, declaracionItems, horariosLectivos }: Props) {
  const [distribuciones, setDistribuciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  
  // Estado para el formulario de agregar
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedDia, setSelectedDia] = useState('LUNES');
  const [horaInicio, setHoraInicio] = useState('07:00');
  const [horaFin, setHoraFin] = useState('08:00');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    cargarDistribucion();
  }, [docenteId, periodoId]);

  const cargarDistribucion = async () => {
    setLoading(true);
    try {
      const res = await apiGet<any[]>('/api/horario/no-lectivo/distribucion', {
        periodoId,
        docenteId,
      });
      setDistribuciones(res.data || []);
    } catch (e) {
      console.error(e);
      setDistribuciones([]);
      setError(e instanceof ApiClientError ? e.message : 'No se pudo cargar la distribución del horario');
    } finally {
      setLoading(false);
    }
  };

  const handleAgregar = () => {
    setError('');
    setSuccess('');
    
    if (!selectedItemId) {
      setError('Seleccione una actividad no lectiva');
      return;
    }
    
    const itemDeclaracion = declaracionItems.find(i => i.id === selectedItemId);
    if (!itemDeclaracion) return;

    const asignadas = horasAsignadasPorActividad[selectedItemId] || 0;
    const hIni = hourStrToInt(horaInicio);
    const hFin = hourStrToInt(horaFin);
    const duracion = hFin - hIni;
    
    if (hIni >= hFin) {
      setError('La hora de fin debe ser mayor a la hora de inicio');
      return;
    }

    if (asignadas + duracion > itemDeclaracion.horasSemanales) {
      setError(`No puede exceder las ${itemDeclaracion.horasSemanales} horas declaradas para esta actividad.`);
      return;
    }

    // Validar cruces
    for (let hour = hIni; hour < hFin; hour++) {
      const colLectiva = horariosLectivos.some(
        h =>
          h.diaSemana === selectedDia &&
          typeof h.horaInicio === 'string' &&
          typeof h.horaFin === 'string' &&
          hourStrToInt(h.horaInicio) <= hour &&
          hourStrToInt(h.horaFin) > hour
      );
      const colNoLectiva = distribuciones.some(
        d =>
          d.diaSemana === selectedDia &&
          typeof d.horaInicio === 'string' &&
          typeof d.horaFin === 'string' &&
          hourStrToInt(d.horaInicio) <= hour &&
          hourStrToInt(d.horaFin) > hour
      );
      if (colLectiva || colNoLectiva) {
        setError(`Cruce de horario detectado a las ${intToHourStr(hour)} el día ${DIAS_LABEL[selectedDia]}`);
        return;
      }
    }
    
    const nuevo = {
      id: `temp-${Date.now()}`,
      declaracionItemId: selectedItemId,
      diaSemana: selectedDia,
      horaInicio,
      horaFin,
      tipoActividad: itemDeclaracion.tipoActividad
    };
    
    setDistribuciones([...distribuciones, nuevo]);
    setSelectedItemId(''); // Resetear el select
  };

  const handleEliminar = (id: string) => {
    setDistribuciones(distribuciones.filter(d => d.id !== id));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        periodoId,
        docenteId, // en caso de ser admin
        distribuciones: distribuciones.map(d => ({
          declaracionItemId: d.declaracionItemId,
          diaSemana: d.diaSemana,
          horaInicio: d.horaInicio,
          horaFin: d.horaFin,
        }))
      };

      await apiPost('/api/horario/no-lectivo/distribuir', payload);
      setSuccess('Horario guardado correctamente');
      cargarDistribucion();
    } catch (e: any) {
      setError(e instanceof ApiClientError ? e.message : e?.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  // Construir matriz
  const matriz = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    DIAS.forEach(d => {
      m[d] = {};
      HORAS.forEach(h => m[d][h] = null);
    });
    
    // Lectivas (Solo Lectura)
    horariosLectivos.forEach(h => {
      if (h.diaSemana && h.horaInicio && h.horaFin) {
        if (!m[h.diaSemana]) m[h.diaSemana] = {};
        const ini = hourStrToInt(h.horaInicio);
        const fin = hourStrToInt(h.horaFin);
        for (let hour = ini; hour < fin; hour++) {
          const key = intToHourStr(hour);
          if (!m[h.diaSemana][key]) {
            m[h.diaSemana][key] = { ...h, tipo: 'LECTIVA', spanStart: hour === ini };
          }
        }
      }
    });
    
    // No Lectivas
    distribuciones.forEach(d => {
      if (d.diaSemana && d.horaInicio && d.horaFin) {
        if (!m[d.diaSemana]) m[d.diaSemana] = {};
        const ini = hourStrToInt(d.horaInicio);
        const fin = hourStrToInt(d.horaFin);
        for (let hour = ini; hour < fin; hour++) {
          const key = intToHourStr(hour);
          if (!m[d.diaSemana][key]) {
            m[d.diaSemana][key] = { ...d, tipo: 'NO_LECTIVA', spanStart: hour === ini };
          }
        }
      }
    });
    
    return m;
  }, [horariosLectivos, distribuciones]);

  // Construir matriz unificada con rowspan
  const grid = useMemo(() => {
    // Array de objetos celda
    // grid[hora][dia]
    const g: Record<string, Record<string, any>> = {};
    HORAS.slice(0, -1).forEach(h => {
      g[h] = {};
      DIAS.forEach(d => g[h][d] = null);
    });

    // Rellenar datos
    DIAS.forEach(dia => {
      let skipRows = 0; // Cuántas celdas hacia abajo saltar
      
      HORAS.slice(0, -1).forEach((hora, idx) => {
        if (skipRows > 0) {
          // Si estamos "dentro" de un bloque que se unió (rowspan), dejamos esta celda invisible
          g[hora][dia] = { skip: true };
          skipRows--;
          return;
        }

        const cell = matriz[dia]?.[hora];
        if (cell && cell.spanStart) {
          // Calcular la duración en horas
          const hIni = hourStrToInt(cell.horaInicio);
          const hFin = hourStrToInt(cell.horaFin);
          const duracion = hFin - hIni;
          
          g[hora][dia] = { 
            ...cell, 
            rowSpan: duracion,
            skip: false 
          };
          skipRows = duracion - 1; // Las siguientes (duracion - 1) celdas se saltan
        } else {
          g[hora][dia] = { skip: false, empty: true };
        }
      });
    });

    return g;
  }, [matriz]);

  // Contar horas asignadas por actividad
  const horasAsignadasPorActividad = useMemo(() => {
    const conteo: Record<string, number> = {};
    distribuciones.forEach(d => {
      const hIni = hourStrToInt(d.horaInicio);
      const hFin = hourStrToInt(d.horaFin);
      const duracion = hFin - hIni;
      conteo[d.declaracionItemId] = (conteo[d.declaracionItemId] || 0) + duracion;
    });
    return conteo;
  }, [distribuciones]);

  const horarioCompleto = useMemo(() => {
    return declaracionItems.every(item => {
      const asignadas = horasAsignadasPorActividad[item.id] || 0;
      return asignadas >= item.horasSemanales;
    });
  }, [declaracionItems, horasAsignadasPorActividad]);

  useEffect(() => {
    if (!selectedItemId) return;
    const item = declaracionItems.find(i => i.id === selectedItemId);
    if (!item) {
      setSelectedItemId('');
      return;
    }
    const asignadas = horasAsignadasPorActividad[item.id] || 0;
    if (asignadas >= item.horasSemanales) setSelectedItemId('');
  }, [selectedItemId, declaracionItems, horasAsignadasPorActividad]);

  const handleExportarPDF = async () => {
    setExportando(true);
    setError('');
    setSuccess('');
    try {
      await downloadFile(
        '/api/reportes/horario-personal',
        { periodoId, docenteId },
        `Horario_Personal_${docenteId}.pdf`
      );
      setSuccess('PDF generado correctamente');
    } catch (e: any) {
      setError(e instanceof ApiClientError ? e.message : e?.message || 'No se pudo generar el PDF');
    } finally {
      setExportando(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Horario Personal
        </h2>
        
        {error && (
          <div className="mb-4 p-3 rounded border text-sm bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded border text-sm bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900">
            {success}
          </div>
        )}
        
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Actividad No Lectiva</label>
            <select 
              value={selectedItemId} 
              onChange={e => setSelectedItemId(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            >
              <option value="">Seleccione una actividad declarada...</option>
              {declaracionItems.map(item => {
                const asignadas = horasAsignadasPorActividad[item.id] || 0;
                if (asignadas >= item.horasSemanales) return null; // Ocultar si ya completó sus horas
                return (
                  <option key={item.id} value={item.id}>
                    {item.tipoActividad} ({asignadas}/{item.horasSemanales}h)
                  </option>
                );
              })}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Día</label>
            <select
              value={selectedDia}
              onChange={e => setSelectedDia(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            >
              {DIAS.map(d => <option key={d} value={d}>{DIAS_LABEL[d]}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Inicio</label>
            <select
              value={horaInicio}
              onChange={e => setHoraInicio(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            >
              {HORAS.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Fin</label>
            <select
              value={horaFin}
              onChange={e => setHoraFin(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            >
              {HORAS.slice(1).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <Button onClick={handleAgregar} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Añadir
          </Button>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-center w-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">Hora</th>
                {DIAS.map(d => (
                  <th
                    key={d}
                    className="p-2 text-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    {DIAS_LABEL[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORAS.slice(0, -1).map((hora, idx) => (
                <tr key={hora}>
                  <td className="p-0 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <div className="flex flex-col items-center justify-center h-full min-h-[60px] text-slate-600 dark:text-slate-300">
                      <span className="font-medium text-[11px] leading-tight whitespace-nowrap">
                        {hora.replace(/^0/, '')}-{HORAS[idx + 1].replace(/^0/, '')}
                      </span>
                    </div>
                  </td>
                  {DIAS.map(dia => {
                    const cell = grid[hora][dia];
                    
                    if (cell.skip) return null; // Oculto porque otra celda ocupa este espacio con rowSpan

                    if (cell.empty) {
                      return (
                        <td
                          key={dia}
                          className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          style={{ height: 60 }}
                        />
                      );
                    }
                    
                    if (cell.tipo === 'LECTIVA') {
                      return (
                        <td
                          key={dia}
                          rowSpan={cell.rowSpan}
                          className="border border-slate-200 dark:border-slate-700 bg-blue-50/80 dark:bg-blue-950/35 p-0 align-top"
                          style={{ height: 60 * cell.rowSpan }}
                        >
                          <div className="h-full w-full p-2 flex flex-col items-center justify-center text-center">
                            <div className="font-bold text-blue-800 dark:text-blue-200 text-[11px] leading-tight">
                              {cell.cursoNombre}
                            </div>
                            <div className="text-blue-600 dark:text-blue-300 text-[10px] mt-1 uppercase">{cell.tipoComponente}</div>
                            <div className="text-slate-500 dark:text-slate-400 text-[10px] mt-1">
                              {cell.horaInicio.replace(/^0/, '')} - {cell.horaFin.replace(/^0/, '')}
                            </div>
                          </div>
                        </td>
                      );
                    } else {
                      return (
                        <td
                          key={dia}
                          rowSpan={cell.rowSpan}
                          className="border border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-950/25 p-0 align-top relative group"
                          style={{ height: 60 * cell.rowSpan }}
                        >
                          <div className="h-full w-full p-2 flex flex-col items-center justify-center text-center px-4">
                            <div className="font-bold text-amber-800 dark:text-amber-200 text-[11px] leading-tight break-words">
                              {cell.tipoActividad}
                            </div>
                            <div className="text-amber-600 dark:text-amber-300 text-[10px] mt-1">
                              {cell.horaInicio.replace(/^0/, '')} - {cell.horaFin.replace(/^0/, '')}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleEliminar(cell.id)}
                            className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      );
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-6 flex justify-between items-center">
          <Button
            onClick={handleExportarPDF}
            disabled={!horarioCompleto || exportando}
            variant="outline"
            className="gap-2 border-slate-300 dark:border-slate-700 disabled:opacity-50"
          >
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Exportar PDF
          </Button>
          <Button onClick={handleGuardar} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Horario Personal
          </Button>
        </div>
      </div>
    </div>
  );
}
