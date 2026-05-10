import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useIncomeVsExpenses } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-lg shadow-lg px-3 py-2">
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

export default function IncomeExpensesMini({ sixMonthsAgo, currentMonth }: Props) {
  const { data = [], isLoading } = useIncomeVsExpenses(sixMonthsAgo, currentMonth);

  const chartData = useMemo(
    () => data.map(d => ({ ...d, month: format(parseISO(`${d.month}-01`), 'MMM yy') })),
    [data],
  );

  const latestNet = data.length > 0 ? data[data.length - 1].net : 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5">
        <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-6 w-28 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-36 flex items-end gap-2 animate-pulse">
          {[60, 45, 72, 55, 80, 50].map((h, i) => (
            <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">Income vs Expenses</h3>
        <Link to="/reports/income" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Net this month:{' '}
        <span className={`font-semibold tabular-nums ${latestNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {formatCurrency(latestNet)}
        </span>
      </p>

      {chartData.length > 0 ? (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: '#6b7280' }}
              />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-8 text-center">Not enough data yet.</p>
      )}
    </div>
  );
}
