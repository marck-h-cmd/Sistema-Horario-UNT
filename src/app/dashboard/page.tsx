'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  GraduationCap,
  LucideIcon,
  Users,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

import { BarChartCard } from '@/components/charts/BarChartCard';
import { PieChartCard } from '@/components/charts/PieChartCard';
import { AreaChartCard } from '@/components/charts/AreaChartCard';
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

// ── Premium KPI card config ────────────────────────────────────────────────
function DashboardKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'text-primary-500 bg-primary-500/10 dark:bg-primary-500/20',
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  colorClass?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-slate-300 dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-slate-700/80">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {title}
          </p>
          <p className="mt-2.5 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">
            {value.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {subtitle}
          </p>
        </div>

        {/* Unified, sleek circular icon badge */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ── Section heading with simple clean layout ──────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="h-4 w-1 rounded-full bg-primary-500 dark:bg-primary-400" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {children}
      </h2>
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

      {/* ── No-period hint ── */}
      {showPeriodoHint && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm dark:border-amber-700/40 dark:from-amber-950/60 dark:to-orange-950/40">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Seleccione un período académico en la barra superior para ver
            indicadores y gráficos detallados.
          </p>
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      {isLoadingContent ? (
        <div className="space-y-8">
          <KpiSkeleton />
          <div className="grid gap-6 lg:grid-cols-2">
            <BarChartCard title=" " data={[]} dataKey="pct" xKey="a" layout="vertical" loading />
            <PieChartCard title=" " data={[]} loading />
          </div>
          <AreaChartCard title=" " data={[]} dataKey="s" xKey="f" loading />
        </div>
      ) : (
        <div className="space-y-10">
          {/* ── KPI CARDS ── */}
          <section>
            <SectionTitle>Indicadores clave</SectionTitle>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardKpiCard
                title="Docentes activos"
                value={resumen?.totalDocentes ?? 0}
                subtitle="Registro general"
                icon={Users}
                colorClass="text-primary-600 bg-primary-500/10 dark:text-primary-400 dark:bg-primary-500/20"
              />
              <DashboardKpiCard
                title="Cursos activos"
                value={resumen?.totalCursos ?? 0}
                subtitle="Catálogo vigente"
                icon={GraduationCap}
                colorClass="text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-850/60"
              />
              <DashboardKpiCard
                title="Ambientes"
                value={resumen?.totalAmbientes ?? 0}
                subtitle="Aulas y laboratorios"
                icon={Building2}
                colorClass="text-[#c9a84c] bg-[#c9a84c]/10 dark:text-[#e2c878] dark:bg-[#c9a84c]/20"
              />
              <DashboardKpiCard
                title="Horarios (período)"
                value={resumen?.totalHorarios ?? 0}
                subtitle="Sesiones programadas"
                icon={CalendarClock}
                colorClass="text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-850/60"
              />
            </div>
          </section>

          {/* ── CHARTS ROW 1 ── */}
          <section>
            <SectionTitle>Distribución & avance</SectionTitle>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <BarChartCard
                title="Ocupación por ambiente"
                description="Porcentaje aproximado de franjas usadas (top 12)"
                data={barOcupacion}
                xKey="ambiente"
                dataKey="pct"
                layout="vertical"
                loading={false}
              />
              <PieChartCard
                title="Avance por categoría docente"
                description="Progreso de horas asignadas vs requeridas"
                data={pieAvance}
              />
            </div>
          </section>

          {/* ── CHART ROW 2 ── */}
          <section>
            <SectionTitle>Actividad semanal</SectionTitle>
            <div className="mt-4">
              <AreaChartCard
                title="Mapa de calor — sesiones por día y hora"
                description="Conteo de inicios de clase entre 8:00 y 19:00 (Lun–Vie)"
                data={barMapaCalor}
                xKey="franja"
                dataKey="sesiones"
                color="#8b5cf6"
              />
            </div>
          </section>

        </div>
      )}
    </div>
  );
}