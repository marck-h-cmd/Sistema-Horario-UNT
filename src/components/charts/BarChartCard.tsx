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
import { CHART_MIN_HEIGHT, CHART_PRIMARY, CHART_COLORS } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';
import { useTheme } from '@/contexts/ThemeContext';

interface BarChartCardProps {
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  dataKey: string;
  xKey: string;
  color?: string;
  className?: string;
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-4 py-3 shadow-xl">
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
  color,
  className,
  loading,
}: BarChartCardProps) {
  const { isDark } = useTheme();

  const filteredData = data.filter(d => (d[dataKey] as number) > 0);

  return (
    <div className={cn('bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm', className)}>
      <div className="p-6">
        <h3 className="text-slate-900 dark:text-white font-semibold">{title}</h3>
        {description && <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{description}</p>}
      </div>
      <div className="p-6 pt-0" style={{ minHeight: CHART_MIN_HEIGHT }}>
        {loading ? (
          <div className="flex items-end gap-4 h-full min-h-[320px] px-4">
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg w-full max-w-12" style={{ height: '40%' }}></div>
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg w-full max-w-12" style={{ height: '75%' }}></div>
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg w-full max-w-12" style={{ height: '55%' }}></div>
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg w-full max-w-12" style={{ height: '30%' }}></div>
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg w-full max-w-12" style={{ height: '60%' }}></div>
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
            <BarChart data={filteredData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {color ? (
                  <linearGradient id="singleBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                  </linearGradient>
                ) : (
                  CHART_COLORS.map((c, i) => (
                    <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.5} />
                    </linearGradient>
                  ))
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey={dataKey}
                radius={[8, 8, 0, 0]}
                maxBarSize={60}
                isAnimationActive={true}
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {filteredData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={color ? 'url(#singleBarGrad)' : `url(#barGrad${i})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
