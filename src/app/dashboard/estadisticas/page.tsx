'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarClock, GraduationCap, Loader2, Users } from 'lucide-react';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { PieChartCard } from '@/components/charts/PieChartCard';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { KpiCard } from '@/components/feedback/KpiCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePeriodo } from '@/contexts/PeriodoContext';
import { Rol } from '@prisma/client';

interface ResumenEstadisticas {
  totalDocentes: number;
  totalCursos: number;
  totalAmbientes: number;
  totalHorarios: number;
  horariosPorEstado: Record<string, number>;
  horariosPorDia: Record<string, number>;
}

interface OcupacionAmbiente {
  codigo: string;
  nombre: string;
  porcentajeOcupacion: number;
  horariosOcupados: number;
}

type AvanceCategoria = Record<
  string,
  {
    porcentajeAvance: number;
    totalDocentes: number;
    totalHorariosAsignados: number;
  }
>;

type MapaCalor = Record<string, Record<string, number>>;

const DIAS_CORTO: Record<string, string> = {
  LUNES: 'Lun',
  MARTES: 'Mar',
  MIERCOLES: 'Mié',
  JUEVES: 'Jue',
  VIERNES: 'Vie',
};

const ORDEN_DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

export default function EstadisticasPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR]);
  const { periodoSeleccionado, loading: periodoLoading } = usePeriodo();
  const periodoId = periodoSeleccionado?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenEstadisticas | null>(null);
  const [ocupacion, setOcupacion] = useState<OcupacionAmbiente[]>([]);
  const [avance, setAvance] = useState<AvanceCategoria | null>(null);
  const [mapaCalor, setMapaCalor] = useState<MapaCalor | null>(null);

  useEffect(() => {
    if (!periodoId) {
      setResumen(null);
      setOcupacion([]);
      setAvance(null);
      setMapaCalor(null);
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [r, o, a, m] = await Promise.all([
          apiGet<ResumenEstadisticas>('/api/estadisticas/resumen', { periodoId }),
          apiGet<OcupacionAmbiente[]>('/api/estadisticas/ocupacion-ambientes', { periodoId }),
          apiGet<AvanceCategoria>('/api/estadisticas/avance-categoria', { periodoId }),
          apiGet<MapaCalor>('/api/estadisticas/mapa-calor', { periodoId }),
        ]);
        if (c) return;
        setResumen(r.data ?? null);
        setOcupacion(o.data ?? []);
        setAvance(a.data ?? null);
        setMapaCalor(m.data ?? null);
      } catch (e) {
        if (!c) setError(e instanceof ApiClientError ? e.message : 'Error al cargar estadísticas');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [periodoId]);

  const pieAvance = useMemo(() => {
    if (!avance) return [];
    return Object.entries(avance).map(([cat, v]) => ({
      name: Formateadores.categoriaDocente(cat),
      value: Math.max(0, v.porcentajeAvance),
    }));
  }, [avance]);

  const barMapaCalor = useMemo(() => {
    if (!mapaCalor) return [];
    const rows: Record<string, unknown>[] = [];
    for (const dia of ORDEN_DIAS) {
      const bloques = mapaCalor[dia];
      if (!bloques) continue;
      for (const hora of Object.keys(bloques).sort()) {
        rows.push({
          franja: `${DIAS_CORTO[dia] ?? dia} ${hora}`,
          sesiones: bloques[hora],
        });
      }
    }
    return rows;
  }, [mapaCalor]);

  const barOcupacion = useMemo(
    () =>
      ocupacion.map((a) => ({
        ambiente: a.nombre || a.codigo,
        pct: a.porcentajeOcupacion,
        ocupadas: a.horariosOcupados,
      })),
    [ocupacion]
  );

  const barPorDia = useMemo(() => {
    if (!resumen?.horariosPorDia) return [];
    return Object.entries(resumen.horariosPorDia).map(([dia, n]) => ({
      dia: DIAS_CORTO[dia] ?? dia,
      cantidad: n,
    }));
  }, [resumen]);

  if (authLoading || periodoLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  if (!periodoId) {
    return (
      <div>
        <PageHeader title="Estadísticas detalladas" description="Análisis del período seleccionado." />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seleccione un período académico.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Estadísticas detalladas"
        description={`Mismos indicadores que el panel principal, con desglose adicional. ${periodoSeleccionado?.nombre ?? ''}`}
      />

      {error && <ErrorAlert message={error} />}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Docentes" value={resumen?.totalDocentes ?? 0} icon={Users} />
            <KpiCard title="Cursos" value={resumen?.totalCursos ?? 0} icon={GraduationCap} />
            <KpiCard title="Ambientes" value={resumen?.totalAmbientes ?? 0} icon={Building2} />
            <KpiCard title="Horarios" value={resumen?.totalHorarios ?? 0} icon={CalendarClock} />
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Horarios por estado</h3>
            </div>
            <div className="card-body text-sm text-gray-700 dark:text-slate-300">
              {resumen?.horariosPorEstado &&
                Object.entries(resumen.horariosPorEstado).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-100 dark:border-slate-700 py-1">
                    <span>{Formateadores.estadoHorario(k)}</span>
                    <span className="font-medium text-unt-blue dark:text-unt-gold-light">{v}</span>
                  </div>
                ))}
            </div>
          </div>

          <BarChartCard
            title="Distribución por día de la semana"
            data={barPorDia}
            xKey="dia"
            dataKey="cantidad"
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <BarChartCard
              title="Ocupación de ambientes (%)"
              data={barOcupacion}
              xKey="ambiente"
              dataKey="pct"
            />
            <PieChartCard title="Avance horario por categoría" data={pieAvance} />
          </div>

          <BarChartCard
            title="Intensidad horaria (mapa de calor agregado)"
            data={barMapaCalor}
            xKey="franja"
            dataKey="sesiones"
          />
        </>
      )}
    </div>
  );
}
