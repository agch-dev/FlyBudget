import { useState, useMemo } from 'react';
import { format, parseISO, subMonths, startOfYear } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNetWorth } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';
import { chartColors } from '../../utils/chartColors';

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg shadow-hover px-3 py-2">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

type Preset = '1m' | '3m' | '6m' | 'ytd' | '1y' | 'all';

const PRESETS: { value: Preset; label: string }[] = [
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'All time' },
];

function computeRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = format(now, 'yyyy-MM');
  switch (preset) {
    case '1m': return { from: format(subMonths(now, 1), 'yyyy-MM'), to };
    case '3m': return { from: format(subMonths(now, 2), 'yyyy-MM'), to };
    case '6m': return { from: format(subMonths(now, 5), 'yyyy-MM'), to };
    case 'ytd': return { from: format(startOfYear(now), 'yyyy-MM'), to };
    case '1y': return { from: format(subMonths(now, 11), 'yyyy-MM'), to };
    case 'all': return { from: '2000-01', to };
  }
}

export default function NetWorthMini() {
  const [preset, setPreset] = useState<Preset>('1m');

  const { from, to } = useMemo(() => computeRange(preset), [preset]);
  const { data = [], isLoading } = useNetWorth(from, to);

  const chartData = useMemo(
    () => data.map(d => ({ ...d, month: format(parseISO(`${d.month}-01`), 'MMM yy') })),
    [data],
  );

  const latest = data.length > 0 ? data[data.length - 1].netWorth : 0;
  const first = data.length > 0 ? data[0].netWorth : latest;
  const change = latest - first;
  const pct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;

  if (isLoading) {
    return (
      <div className="py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="h-8 w-48 bg-surface-alt rounded animate-pulse" />
          <div className="h-8 w-28 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="h-28 bg-surface-alt rounded animate-pulse mt-4" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Net Worth</p>
          <p className={`text-3xl font-semibold tabular-nums mt-1 ${latest >= 0 ? 'text-text' : 'text-negative'}`}>
            {formatCurrency(latest)}
          </p>
          {data.length > 1 && (
            <p className={`text-sm tabular-nums mt-0.5 ${change >= 0 ? 'text-positive' : 'text-negative'}`}>
              {change >= 0 ? '+' : ''}{formatCurrency(change)} ({Math.abs(pct).toFixed(1)}%)
            </p>
          )}
        </div>

        <select
          value={preset}
          onChange={e => setPreset(e.target.value as Preset)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          {PRESETS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {chartData.length > 1 && (
        <div className="h-28 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gNetMini" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.brand} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={chartColors.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: chartColors.axis }}
                axisLine={false}
                tickLine={false}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<MiniTooltip />} />
              <Area
                type="monotone"
                dataKey="netWorth"
                name="Net Worth"
                stroke={chartColors.brand}
                strokeWidth={2}
                fill="url(#gNetMini)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
