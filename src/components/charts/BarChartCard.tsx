'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_MIN_HEIGHT, CHART_COLORS } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';
import { useTheme } from '@/contexts/ThemeContext';

interface BarChartCardProps {
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  dataKey: string;
  xKey: string;
  className?: string;
  loading?: boolean;
  color?: string;
  colors?: string[];
  layout?: 'horizontal' | 'vertical';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/90 dark:bg-slate-950/95 backdrop-blur-md px-4 py-3 shadow-2xl">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{payload[0].value}</p>
    </div>
  );
};

export function BarChartCard({
  title,
  description,
  data,
  dataKey,
  xKey,
  className,
  loading,
  color,
  colors,
  layout = 'horizontal',
}: BarChartCardProps) {
  const { isDark } = useTheme();

  const filteredData = data.filter(d => (d[dataKey] as number) > 0);
  
  // Determinar los colores a usar: priority → colors prop → color prop → CHART_COLORS
  let coloresParaUsar = CHART_COLORS;
  if (colors && colors.length > 0) {
    coloresParaUsar = colors;
  } else if (color) {
    coloresParaUsar = [color];
  }

  const isVertical = layout === 'vertical';

  return (
    <div className={cn('bg-white/95 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300', className)}>
      <div className="p-6">
        <h3 className="text-slate-900 dark:text-white font-semibold">{title}</h3>
        {description && <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{description}</p>}
      </div>
      <div className="p-6 pt-0" style={{ minHeight: CHART_MIN_HEIGHT }}>
        {loading ? (
          <div className="flex items-end gap-4 h-full min-h-[320px] px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg w-full max-w-12"
                style={{ height: `${40 + i * 10}%` }}
              ></div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center">
            <svg className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-slate-600 dark:text-slate-300 font-medium">Sin datos disponibles</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
            <BarChart
              data={filteredData}
              layout={layout}
              margin={{ top: 8, right: 8, left: isVertical ? 20 : 0, bottom: 0 }}
            >
              <defs>
                {coloresParaUsar.map((c, i) => (
                  <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2={isVertical ? "1" : "0"} y2={isVertical ? "0" : "1"}>
                    <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.5} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={isVertical} horizontal={!isVertical} />
              
              {isVertical ? (
                <>
                  <XAxis
                    type="number"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey={xKey}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey={xKey}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                  />
                </>
              )}
              
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey={dataKey}
                radius={isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                maxBarSize={isVertical ? 24 : 48}
                isAnimationActive
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {filteredData.map((_, i) => (
                  <Cell key={i} fill={`url(#barGrad${i % coloresParaUsar.length})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}