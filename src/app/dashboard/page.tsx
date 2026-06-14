'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  GraduationCap,
  Loader2,
  LucideIcon,
  Users,
} from 'lucide-react';

import { BarChartCard } from '@/components/charts/BarChartCard';
import { PieChartCard } from '@/components/charts/PieChartCard';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { KpiSkeleton } from '@/components/feedback/KpiSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { usePeriodo } from '@/contexts/PeriodoContext';

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
}

type AvanceCategoria = Record<
  string,
  {
    porcentajeAvance: number;
    totalDocentes: number;
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

const CHART_COLORS = {
  blue: '#2563EB',
  emerald: '#10B981',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  rose: '#F43F5E',
};

const KPI_STYLES = [
  {
    wrapper:
      'border-blue-100 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900/60 dark:from-blue-950/50 dark:to-slate-900',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-300',
  },
  {
    wrapper:
      'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/60 dark:from-emerald-950/50 dark:to-slate-900',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300',
  },
  {
    wrapper:
      'border-amber-100 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900/60 dark:from-amber-950/50 dark:to-slate-900',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300',
  },
  {
    wrapper:
      'border-violet-100 bg-gradient-to-br from-violet-50 to-white dark:border-violet-900/60 dark:from-violet-950/50 dark:to-slate-900',
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300',
  },
];

function DashboardKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  variant: number;
}) {
  const style = KPI_STYLES[variant];

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${style.wrapper}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {title}
          </p>

          <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${style.icon}`}
        >
          <Icon className="h-7 w-7" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
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

    let cancelled = false;

    async function cargarDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [r, o, a, m] = await Promise.all([
          apiGet<ResumenEstadisticas>('/api/estadisticas/resumen', { periodoId }),
          apiGet<OcupacionAmbiente[]>('/api/estadisticas/ocupacion-ambientes', {
            periodoId,
          }),
          apiGet<AvanceCategoria>('/api/estadisticas/avance-categoria', {
            periodoId,
          }),
          apiGet<MapaCalor>('/api/estadisticas/mapa-calor', { periodoId }),
        ]);

        if (cancelled) return;

        setResumen(r.data ?? null);
        setOcupacion(o.data ?? []);
        setAvance(a.data ?? null);
        setMapaCalor(m.data ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ApiClientError
              ? e.message
              : 'Error al cargar el dashboard'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    cargarDashboard();

    return () => {
      cancelled = true;
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
      ocupacion.slice(0, 12).map((a) => ({
        ambiente: a.codigo,
        pct: a.porcentajeOcupacion,
      })),
    [ocupacion]
  );

  const showPeriodoHint = !periodoLoading && !periodoId;
  const isLoadingContent = periodoLoading || (!!periodoId && loading);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Panel principal"
        description={
          periodoSeleccionado
            ? `Datos del período: ${periodoSeleccionado.nombre}`
            : 'Resumen operativo del sistema de horarios UNT.'
        }
      />

      {showPeriodoHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Seleccione un período académico en la barra superior para ver indicadores
          y gráficos detallados.
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      {isLoadingContent ? (
        <div className="space-y-8">
          <KpiSkeleton />

          <div className="grid gap-6 lg:grid-cols-2">
            <BarChartCard title=" " data={[]} dataKey="pct" xKey="a" loading />
            <PieChartCard title=" " data={[]} loading />
          </div>

          <BarChartCard title=" " data={[]} dataKey="s" xKey="f" loading />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardKpiCard
              title="Docentes activos"
              value={resumen?.totalDocentes ?? 0}
              subtitle="Registro general"
              icon={Users}
              variant={0}
            />

            <DashboardKpiCard
              title="Cursos activos"
              value={resumen?.totalCursos ?? 0}
              subtitle="Catálogo vigente"
              icon={GraduationCap}
              variant={1}
            />

            <DashboardKpiCard
              title="Ambientes"
              value={resumen?.totalAmbientes ?? 0}
              subtitle="Aulas y laboratorios"
              icon={Building2}
              variant={2}
            />

            <DashboardKpiCard
              title="Horarios (período)"
              value={resumen?.totalHorarios ?? 0}
              subtitle="Sesiones programadas"
              icon={CalendarClock}
              variant={3}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <BarChartCard
              title="Ocupación por ambiente"
              description="Porcentaje aproximado de franjas usadas (top 12)"
              data={barOcupacion}
              xKey="ambiente"
              dataKey="pct"
              loading={false}
            />

            <PieChartCard
              title="Avance por categoría docente"
              description="Progreso de horas asignadas vs requeridas"
              data={pieAvance}
            />
          </div>

          <BarChartCard
            title="Mapa de calor — sesiones por día y hora"
            description="Conteo de inicios de clase entre 8:00 y 19:00 (Lun–Vie)"
            data={barMapaCalor}
            xKey="franja"
            dataKey="sesiones"
          />
        </div>
      )}
    </div>
  );
}