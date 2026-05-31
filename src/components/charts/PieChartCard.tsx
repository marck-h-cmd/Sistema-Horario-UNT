'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CHART_MIN_HEIGHT } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';
import { useTheme } from '@/contexts/ThemeContext';

interface PieChartCardProps {
  title: string;
  description?: string;
  data: { name: string; value: number }[];
  className?: string;
  loading?: boolean;
}

const DONUT_COLORS = [
  '#f59e0b',
  '#6366f1',
  '#10b981',
  '#f43f5e',
  '#0ea5e9',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{payload[0].name}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{payload[0].value}</p>
    </div>
  );
};

export function PieChartCard({ title, description, data, className, loading }: PieChartCardProps) {
  const { isDark } = useTheme();

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={cn('bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm', className)}>
      <div className="p-6">
        <h3 className="text-slate-900 dark:text-white font-semibold">{title}</h3>
        {description && <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{description}</p>}
      </div>
      <div className="p-6 pt-0" style={{ minHeight: CHART_MIN_HEIGHT }}>
        {loading ? (
          <div className="flex items-center justify-center h-full min-h-[320px]">
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-full w-48 h-48"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center">
            <svg className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            <p className="text-slate-600 dark:text-slate-300 font-medium">Sin datos disponibles</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
            <PieChart>
              <defs>
                {DONUT_COLORS.map((color, i) => (
                  <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={4}
                strokeWidth={0}
                isAnimationActive={true}
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={`url(#pieGrad${i})`} />
                ))}
              </Pie>
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                <tspan fontSize="28" fontWeight="800" fill="#0f172a">
                  {total}
                </tspan>
                <tspan x="50%" dy="22" fontSize="11" fill="#64748b">Total</tspan>
              </text>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
