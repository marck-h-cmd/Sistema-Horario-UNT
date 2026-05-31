'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { HorarioCalendarioPublico } from '@/components/horarios/HorarioCalendarioPublico';
import { Loader2 } from 'lucide-react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIA_LABEL: Record<string, string> = { LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles', JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado' };
const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 a 21:00

export default function HorariosPublicosPage() {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState<string>('');
  const [ciclo, setCiclo] = useState<string>('');
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);

  useEffect(() => {
    // Obtener periodos disponibles (en producción debería ser un endpoint público también o filtrar activos/finalizados)
    apiGet<any[]>('/api/periodos', { limit: 100 })
      .then(res => {
        const activos = (res.data ?? []).filter((p: any) => p.estado === 'ACTIVO' || p.estado === 'FINALIZADO');
        setPeriodos(activos);
        if (activos.length > 0) {
          setPeriodoId(activos[0].id);
        }
      })
      .finally(() => setLoadingPeriodos(false));
  }, []);

  useEffect(() => {
    if (!periodoId) return;
    setLoading(true);
    apiGet<any[]>('/api/horarios-publicos', { periodoId, ciclo })
      .then(res => setHorarios(res.data ?? []))
      .finally(() => setLoading(false));
  }, [periodoId, ciclo]);

  if (loadingPeriodos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2 print:hidden">
          <h1 className="text-3xl font-bold text-slate-800">Horarios Universitarios</h1>
          <p className="text-slate-600">Consulta los horarios publicados para el ciclo académico</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border flex flex-wrap gap-4 items-center justify-center print:hidden">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Período:</label>
            <select
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-unt-blue focus:outline-none"
            >
              {periodos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Ciclo (Opcional):</label>
            <select
              value={ciclo}
              onChange={(e) => setCiclo(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-unt-blue focus:outline-none"
            >
              <option value="">Todos los ciclos</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(c => (
                <option key={c} value={c}>Ciclo {c}</option>
              ))}
            </select>
          </div>
        </div>

        {horarios.length === 0 && !loading && (
          <div className="text-center p-12 bg-white rounded-lg shadow border print:hidden">
            <p className="text-slate-500">No hay horarios publicados para la selección actual.</p>
          </div>
        )}

        {(horarios.length > 0 || loading) && (
          <HorarioCalendarioPublico
            horarios={horarios}
            dias={DIAS}
            diaLabels={DIA_LABEL}
            horas={HORAS}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
