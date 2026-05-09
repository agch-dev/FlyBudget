import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNetWorth } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="h-5 w-28 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-6 w-36 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-36 flex items-end gap-2 animate-pulse">
          {[55, 72, 40, 85, 60, 78].map((h, i) => (
            <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">Net Worth</h3>
        <Link to="/reports/net-worth" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
      </div>
      <p className={`text-xl font-bold tabular-nums mb-3 ${latest >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
        {formatCurrency(latest)}
      </p>

      {chartData.length > 1 ? (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gNetMini" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Area
                type="monotone"
                dataKey="netWorth"
                name="Net Worth"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#gNetMini)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-8 text-center">Not enough data yet.</p>
      )}
    </div>
  );
}
