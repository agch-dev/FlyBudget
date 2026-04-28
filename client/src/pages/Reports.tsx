import { useState, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useNetWorth, useIncomeVsExpenses, useCashFlow, useSpendingByCategory } from '../hooks/useReports';
import { formatCurrency, formatCentsAxis } from '../utils/currency';

type Tab = 'net-worth' | 'income' | 'cash-flow' | 'spending';

const TABS: { id: Tab; label: string }[] = [
  { id: 'net-worth', label: 'Net Worth' },
  { id: 'income', label: 'Income & Expenses' },
  { id: 'cash-flow', label: 'Cash Flow' },
  { id: 'spending', label: 'Spending by Category' },
];

function monthLabel(month: string) {
  const [y, m] = month.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m) - 1]} ${y.slice(2)}`;
}

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

function NetWorthChart({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useNetWorth(from, to);
  const chartData = useMemo(() => data.map(d => ({ ...d, month: monthLabel(d.month) })), [data]);

  if (isLoading) return <ChartSkeleton />;
  if (!chartData.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
        <defs>
          <linearGradient id="gAssets" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gLiab" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCentsAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
        <Tooltip content={<CurrencyTooltip />} />
        <Area type="monotone" dataKey="assets" name="Assets" stroke="#10b981" strokeWidth={2} fill="url(#gAssets)" dot={false} />
        <Area type="monotone" dataKey="liabilities" name="Liabilities" stroke="#ef4444" strokeWidth={2} fill="url(#gLiab)" dot={false} />
        <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#3b82f6" strokeWidth={2} fill="url(#gNet)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function IncomeExpensesChart({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useIncomeVsExpenses(from, to);
  const chartData = useMemo(() => data.map(d => ({ ...d, month: monthLabel(d.month) })), [data]);

  if (isLoading) return <ChartSkeleton />;
  if (!chartData.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCentsAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
        <Tooltip content={<CurrencyTooltip />} />
        <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CashFlowChart({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useCashFlow(from, to);
  const chartData = useMemo(() => data.map(d => ({ ...d, month: monthLabel(d.month) })), [data]);

  if (isLoading) return <ChartSkeleton />;
  if (!chartData.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCentsAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
        <Tooltip content={<CurrencyTooltip />} />
        <Bar dataKey="net" name="Net Cash Flow" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.net >= 0 ? '#10b981' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SpendingChart({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useSpendingByCategory(from, to);
  const chartData = useMemo(
    () => [...data]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 15)
      .map(d => ({ name: d.categoryName ?? 'Uncategorized', value: d.totalSpent })),
    [data],
  );

  if (isLoading) return <ChartSkeleton />;
  if (!chartData.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis type="number" tickFormatter={formatCentsAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={110} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="bg-white border border-gray-100 rounded-lg shadow-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-xs font-medium text-blue-600">{formatCurrency(payload[0].value as number)}</p>
              </div>
            ) : null
          }
        />
        <Bar dataKey="value" name="Spent" fill="#6366f1" radius={[0, 3, 3, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-sm text-gray-400">Loading…</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-sm text-gray-400">No data for this period.</div>
    </div>
  );
}

export default function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(() => format(subMonths(today, 11), 'yyyy-MM'));
  const [to, setTo] = useState(() => format(today, 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState<Tab>('net-worth');

  const chartHeight = activeTab === 'spending' ? 'h-96' : 'h-72';

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-5 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">From</span>
            <input
              type="month"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="month"
              value={to}
              min={from}
              max={format(today, 'yyyy-MM')}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === t.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className={`w-full ${chartHeight}`}>
          {activeTab === 'net-worth' && <NetWorthChart from={from} to={to} />}
          {activeTab === 'income' && <IncomeExpensesChart from={from} to={to} />}
          {activeTab === 'cash-flow' && <CashFlowChart from={from} to={to} />}
          {activeTab === 'spending' && <SpendingChart from={from} to={to} />}
        </div>
      </div>
    </div>
  );
}
