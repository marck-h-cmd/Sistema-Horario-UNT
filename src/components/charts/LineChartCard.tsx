'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_MIN_HEIGHT } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';
import { useTheme } from '@/contexts/ThemeContext';

interface LineChartCardProps {
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  dataKey: string;
  xKey: string;
  className?: string;
  loading?: boolean;
  color?: string;
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

export function LineChartCard({
  title,
  description,
  data,
  dataKey,
  xKey,
  className,
  loading,
  color = '#c9a84c',
}: LineChartCardProps) {
  const { isDark } = useTheme();

  return (
    <div className={cn('bg-white/95 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300', className)}>
      <div className="p-6">
        <h3 className="text-slate-900 dark:text-white font-semibold">{title}</h3>
        {description && <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{description}</p>}
      </div>
      <div className="p-6 pt-0" style={{ minHeight: CHART_MIN_HEIGHT }}>
        {loading ? (
          <div className="flex items-center justify-center h-full min-h-[320px]">
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl w-full h-[280px]"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center">
            <p className="text-slate-600 dark:text-slate-300 font-medium">Sin datos disponibles</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
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
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={3}
                dot={{ stroke: color, strokeWidth: 2, r: 4, fill: isDark ? '#090b14' : '#ffffff' }}
                activeDot={{ stroke: color, strokeWidth: 2, r: 6, fill: color }}
                isAnimationActive
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
