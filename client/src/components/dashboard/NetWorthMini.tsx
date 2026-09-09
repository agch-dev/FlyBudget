import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

interface Props {
  sixMonthsAgo: string;
  currentMonth: string;
}

export default function NetWorthMini({ sixMonthsAgo, currentMonth }: Props) {
  const { data = [], isLoading } = useNetWorth(sixMonthsAgo, currentMonth);

  const chartData = useMemo(
    () => data.map(d => ({ ...d, month: format(parseISO(`${d.month}-01`), 'MMM yy') })),
    [data],
  );

  const latest = data.length > 0 ? data[data.length - 1].netWorth : 0;
  const prev = data.length > 1 ? data[data.length - 2].netWorth : latest;
  const change = latest - prev;

  if (isLoading) {
    return (
      <div className="py-2">
        <div className="h-4 w-20 bg-surface-alt rounded animate-pulse mb-2" />
        <div className="h-8 w-40 bg-surface-alt rounded animate-pulse mb-1" />
        <div className="h-3 w-24 bg-surface-alt rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Net Worth</p>
      <p className={`text-3xl font-semibold tabular-nums mt-1 ${latest >= 0 ? 'text-text' : 'text-negative'}`}>
        {formatCurrency(latest)}
      </p>
      {data.length > 1 && (
        <p className={`text-sm tabular-nums mt-0.5 ${change >= 0 ? 'text-positive' : 'text-negative'}`}>
          {change >= 0 ? '+' : ''}{formatCurrency(change)} this month
        </p>
      )}

      {chartData.length > 1 && (
        <div className="h-28 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
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
              />
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
