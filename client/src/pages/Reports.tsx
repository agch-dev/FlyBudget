import { useState, useMemo, useCallback } from 'react';
import { format, subMonths, parseISO } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Sankey,
} from 'recharts';
import {
  useNetWorth, useIncomeVsExpenses, useCashFlow,
  useSpendingByCategory, useIncomeByCategory,
} from '../hooks/useReports';
import { formatCurrency, formatCentsAxis } from '../utils/currency';

type Tab = 'net-worth' | 'income' | 'cash-flow' | 'spending' | 'sankey';
type NodeType = 'income' | 'hub' | 'expense' | 'savings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'net-worth', label: 'Net Worth' },
  { id: 'income', label: 'Income & Expenses' },
  { id: 'cash-flow', label: 'Cash Flow' },
  { id: 'spending', label: 'Spending by Category' },
  { id: 'sankey', label: 'Cash Flow Diagram' },
];

const CHART_HEIGHT: Record<Tab, string> = {
  'net-worth': 'h-72',
  'income': 'h-72',
  'cash-flow': 'h-72',
  'spending': 'h-96',
  'sankey': 'h-[540px]',
};

const EXPENSE_COLORS = ['#f59e0b', '#ef4444', '#f97316', '#06b6d4', '#6366f1', '#ec4899', '#84cc16', '#0ea5e9', '#a78bfa', '#fb7185'];
const MIN_SAVINGS_CENTS = 500; // $5 — suppress trivial rounding-error surpluses

const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMM yy');

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

function SankeyDiagram({ from, to }: { from: string; to: string }) {
  const { data: incomeData = [], isLoading: il } = useIncomeByCategory(from, to);
  const { data: spendingData = [], isLoading: sl } = useSpendingByCategory(from, to);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; value: string } | null>(null);

  const sankeyData = useMemo(() => {
    if (!incomeData.length && !spendingData.length) return null;

    const groupTotals = new Map<string, number>();
    for (const item of spendingData) {
      const key = item.groupName ?? 'Uncategorized';
      groupTotals.set(key, (groupTotals.get(key) ?? 0) + item.totalSpent);
    }
    const sortedGroups = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]);

    const totalIncome = incomeData.reduce((sum, c) => sum + c.totalReceived, 0);
    const totalExpenses = sortedGroups.reduce((sum, [, v]) => sum + v, 0);
    const savings = totalIncome - totalExpenses;

    const incomeNodes = incomeData.map(c => ({
      name: c.categoryName ?? 'Income',
      nodeType: 'income' as NodeType,
      amount: c.totalReceived,
      color: '#10b981',
    }));

    const hubIdx = incomeNodes.length;

    const expenseNodes = sortedGroups.map(([name, amount], i) => ({
      name,
      nodeType: 'expense' as NodeType,
      amount,
      color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
    }));

    const savingsNode = savings > MIN_SAVINGS_CENTS
      ? [{ name: 'Savings', nodeType: 'savings' as NodeType, amount: savings, color: '#8b5cf6' }]
      : [];

    const nodes = [
      ...incomeNodes,
      { name: 'Total Income', nodeType: 'hub' as NodeType, amount: totalIncome, color: '#3b82f6' },
      ...expenseNodes,
      ...savingsNode,
    ];

    const links = [
      ...incomeNodes.map((_, i) => ({ source: i, target: hubIdx, value: incomeData[i].totalReceived })),
      ...sortedGroups.map(([, amount], i) => ({ source: hubIdx, target: hubIdx + 1 + i, value: amount })),
      ...(savingsNode.length ? [{ source: hubIdx, target: nodes.length - 1, value: savings }] : []),
    ].filter(l => l.value > 0);

    return links.length ? { nodes, links } : null;
  }, [incomeData, spendingData]);

  const renderNode = useCallback((props: any) => {
    const { x, y, width, height, payload } = props;
    if (!payload || height < 1) return null;

    const { name, nodeType, amount, color } = payload;
    const isLeft = nodeType === 'income';
    const labelX = isLeft ? x - 8 : x + width + 8;
    const anchor = isLeft ? 'end' : 'start';
    const midY = y + height / 2;

    return (
      <g
        onMouseEnter={(e: React.MouseEvent) => setTooltip({ x: e.clientX, y: e.clientY, title: name, value: formatCurrency(amount) })}
        onMouseLeave={() => setTooltip(null)}
        style={{ cursor: 'default' }}
      >
        <rect x={x} y={y} width={width} height={height} fill={color} rx={3} />
        <text
          x={labelX}
          y={height > 22 ? midY - 6 : midY + 1}
          textAnchor={anchor}
          fontSize={11}
          fill="#374151"
          fontWeight="500"
        >
          {name}
        </text>
        {height > 22 && (
          <text x={labelX} y={midY + 9} textAnchor={anchor} fontSize={10} fill="#9ca3af">
            {formatCentsAxis(amount)}
          </text>
        )}
      </g>
    );
  }, [setTooltip]);

  const renderLink = useCallback((props: any) => {
    const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload } = props;
    if (!linkWidth || linkWidth < 1) return null;

    const halfW = linkWidth / 2;
    const color = payload?.target?.color ?? '#94a3b8';
    const d = [
      `M${sourceX},${sourceY - halfW}`,
      `C${sourceControlX},${sourceY - halfW} ${targetControlX},${targetY - halfW} ${targetX},${targetY - halfW}`,
      `L${targetX},${targetY + halfW}`,
      `C${targetControlX},${targetY + halfW} ${sourceControlX},${sourceY + halfW} ${sourceX},${sourceY + halfW}`,
      'Z',
    ].join(' ');

    const srcName = payload?.source?.name ?? '';
    const tgtName = payload?.target?.name ?? '';
    const value = payload?.value ?? 0;

    return (
      <path
        d={d}
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={0.5}
        strokeOpacity={0.4}
        onMouseEnter={(e: React.MouseEvent) => setTooltip({
          x: e.clientX,
          y: e.clientY,
          title: `${srcName} → ${tgtName}`,
          value: formatCurrency(value),
        })}
        onMouseLeave={() => setTooltip(null)}
        style={{ cursor: 'default' }}
      />
    );
  }, [setTooltip]);

  if (il || sl) return <ChartSkeleton />;
  if (!sankeyData) return <EmptyState />;

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankeyData}
          nodePadding={14}
          nodeWidth={18}
          linkCurvature={0.5}
          margin={{ top: 20, right: 220, left: 220, bottom: 20 }}
          node={renderNode as any}
          link={renderLink as any}
        />
      </ResponsiveContainer>
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="text-xs font-medium text-gray-800">{tooltip.title}</p>
          <p className="text-xs text-emerald-600 font-medium">{tooltip.value}</p>
        </div>
      )}
    </div>
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

  const chartHeight = CHART_HEIGHT[activeTab];

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
          {activeTab === 'sankey' && <SankeyDiagram from={from} to={to} />}
        </div>
      </div>
    </div>
  );
}
