import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, parseISO, startOfYear, endOfYear, subYears } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Sankey,
} from 'recharts';
import {
  useNetWorth, useIncomeVsExpenses, useCashFlow,
  useSpendingByCategory, useIncomeByCategory, useSpendingTrends,
} from '../hooks/useReports';
import { useCategories } from '../hooks/useCategories';
import { formatCurrency, formatCentsAxis } from '../utils/currency';
import { downloadCsv } from '../utils/exportCsv';
import { Download, Plus } from 'lucide-react';
import { CurrencyTooltip, ChartSkeleton, EmptyState, StatCardRow, EXPENSE_COLORS, monthLabel } from '../components/reports/ChartHelpers';
import type { StatCard } from '../components/reports/ChartHelpers';

type Tab = 'net-worth' | 'income' | 'cash-flow' | 'spending' | 'sankey' | 'trends';
type Preset = '3m' | '6m' | 'ytd' | 'last-year' | 'custom';
type NodeType = 'income' | 'hub' | 'expense' | 'savings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'net-worth', label: 'Net Worth' },
  { id: 'income', label: 'Income & Expenses' },
  { id: 'cash-flow', label: 'Cash Flow' },
  { id: 'spending', label: 'Spending by Category' },
  { id: 'sankey', label: 'Cash Flow Diagram' },
  { id: 'trends', label: 'Spending Trends' },
];

const PRESETS: { id: Preset; label: string }[] = [
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: 'ytd', label: 'This Year' },
  { id: 'last-year', label: 'Last Year' },
  { id: 'custom', label: 'Custom' },
];

const CHART_HEIGHT: Record<Tab, string> = {
  'net-worth': 'h-72',
  'income': 'h-72',
  'cash-flow': 'h-72',
  'spending': 'h-96',
  'sankey': 'h-[540px]',
  'trends': 'h-80',
};

const MIN_SAVINGS_CENTS = 500;

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
              <div className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-lg shadow-lg px-3 py-2">
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

function SpendingTrendsChart({ from, to }: { from: string; to: string }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: groups = [] } = useCategories();
  const { data: trendData = [], isLoading } = useSpendingTrends(selectedIds, from, to);

  const expenseCategories = useMemo(
    () => (groups as any[]).filter((g: any) => g.isIncome === 0).flatMap((g: any) => g.categories),
    [groups],
  );

  const chartData = useMemo(() => {
    if (!trendData.length) return [];
    const monthSet = new Set(trendData.map(r => r.month));
    const months = [...monthSet].sort();
    return months.map(month => {
      const row: Record<string, string | number> = { month: monthLabel(month) };
      for (const point of trendData) {
        if (point.month === month) row[point.categoryName ?? point.categoryId] = point.total;
      }
      return row;
    });
  }, [trendData]);

  const selectedNames = useMemo(() => {
    return selectedIds.map(id => {
      const cat = expenseCategories.find((c: any) => c.id === id);
      return cat?.name ?? id;
    });
  }, [selectedIds, expenseCategories]);

  function toggleCategory(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {expenseCategories.map((cat: any) => {
          const checked = selectedIds.includes(cat.id);
          const disabled = !checked && selectedIds.length >= 5;
          return (
            <button
              key={cat.id}
              onClick={() => !disabled && toggleCategory(cat.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                checked
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : disabled
                  ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
        {expenseCategories.length === 0 && (
          <span className="text-xs text-gray-400">No expense categories found.</span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {selectedIds.length === 0 ? (
          <EmptyState message="Select categories above to compare trends." />
        ) : isLoading ? (
          <ChartSkeleton />
        ) : !chartData.length ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCentsAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {selectedNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
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

export default function ReportsPage() {
  const today = new Date();
  const [preset, setPreset] = useState<Preset>('custom');
  const [from, setFrom] = useState(() => format(subMonths(today, 11), 'yyyy-MM'));
  const [to, setTo] = useState(() => format(today, 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState<Tab>('net-worth');

  useEffect(() => {
    if (preset === 'custom') return;
    const now = new Date();
    const ranges: Record<string, { from: string; to: string }> = {
      '3m':        { from: format(subMonths(now, 2), 'yyyy-MM'), to: format(now, 'yyyy-MM') },
      '6m':        { from: format(subMonths(now, 5), 'yyyy-MM'), to: format(now, 'yyyy-MM') },
      'ytd':       { from: format(startOfYear(now), 'yyyy-MM'),  to: format(now, 'yyyy-MM') },
      'last-year': { from: format(startOfYear(subYears(now, 1)), 'yyyy-MM'), to: format(endOfYear(subYears(now, 1)), 'yyyy-MM') },
    };
    const r = ranges[preset];
    setFrom(r.from);
    setTo(r.to);
  }, [preset]);

  // Fetch all data at the top level — chart sub-components use the same query keys (cache hit)
  const { data: nwData = [] } = useNetWorth(from, to);
  const { data: ieData = [] } = useIncomeVsExpenses(from, to);
  const { data: cfData = [] } = useCashFlow(from, to);
  const { data: spData = [] } = useSpendingByCategory(from, to);
  const { data: incData = [] } = useIncomeByCategory(from, to);

  const statCards = useMemo((): StatCard[] => {
    switch (activeTab) {
      case 'net-worth': {
        if (!nwData.length) return [];
        const latest = nwData[nwData.length - 1].netWorth;
        const change = nwData.length > 1 ? latest - nwData[0].netWorth : 0;
        const sign = change >= 0 ? '+' : '';
        return [
          { label: 'Net Worth', value: formatCurrency(latest) },
          { label: 'Period Change', value: `${sign}${formatCurrency(change)}` },
        ];
      }
      case 'income': {
        const totalIncome = ieData.reduce((s, d) => s + d.income, 0);
        const totalExpenses = ieData.reduce((s, d) => s + d.expenses, 0);
        const net = totalIncome - totalExpenses;
        const rate = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0;
        return [
          { label: 'Total Income', value: formatCurrency(totalIncome) },
          { label: 'Total Expenses', value: formatCurrency(totalExpenses) },
          { label: 'Net Savings', value: formatCurrency(net) },
          { label: 'Savings Rate', value: `${rate}%` },
        ];
      }
      case 'cash-flow': {
        const periodNet = cfData.reduce((s, d) => s + d.net, 0);
        const positiveMonths = cfData.filter(d => d.net > 0).length;
        return [
          { label: 'Period Net', value: formatCurrency(periodNet) },
          { label: 'Positive Months', value: `${positiveMonths} of ${cfData.length}` },
        ];
      }
      case 'spending': {
        const totalSpent = spData.reduce((s, d) => s + d.totalSpent, 0);
        return [
          { label: 'Total Spent', value: formatCurrency(totalSpent) },
          { label: 'Categories', value: String(spData.length) },
        ];
      }
      case 'sankey': {
        const totalIncome = incData.reduce((s, d) => s + d.totalReceived, 0);
        const totalExpenses = spData.reduce((s, d) => s + d.totalSpent, 0);
        const savings = totalIncome - totalExpenses;
        return [
          { label: 'Total Income', value: formatCurrency(totalIncome) },
          { label: 'Total Expenses', value: formatCurrency(totalExpenses) },
          { label: 'Savings', value: formatCurrency(Math.max(savings, 0)) },
        ];
      }
      case 'trends':
        return [];
    }
  }, [activeTab, nwData, ieData, cfData, spData, incData]);

  function handleExport() {
    const filename = `reports-${activeTab}-${from}-${to}.csv`;
    switch (activeTab) {
      case 'net-worth':
        downloadCsv(filename, nwData.map(d => ({ month: d.month, assets_cents: d.assets, liabilities_cents: d.liabilities, net_worth_cents: d.netWorth })));
        break;
      case 'income':
        downloadCsv(filename, ieData.map(d => ({ month: d.month, income_cents: d.income, expenses_cents: d.expenses, net_cents: d.net })));
        break;
      case 'cash-flow':
        downloadCsv(filename, cfData.map(d => ({ month: d.month, net_cents: d.net })));
        break;
      case 'spending':
      case 'sankey':
        downloadCsv(filename, spData.map(d => ({ category: d.categoryName ?? 'Uncategorized', group: d.groupName ?? '', total_cents: d.totalSpent })));
        break;
      case 'trends':
        break;
    }
  }

  const chartHeight = CHART_HEIGHT[activeTab];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-b from-white to-slate-50/50 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-800 shrink-0">Reports</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                    preset === p.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <>
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
              </>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <Link
              to="/reports/custom"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Custom Report
            </Link>
          </div>
        </div>
        <div className="flex gap-1 mt-4 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                activeTab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <StatCardRow cards={statCards} />
        <div className={`w-full ${chartHeight}`}>
          {activeTab === 'net-worth' && <NetWorthChart from={from} to={to} />}
          {activeTab === 'income' && <IncomeExpensesChart from={from} to={to} />}
          {activeTab === 'cash-flow' && <CashFlowChart from={from} to={to} />}
          {activeTab === 'spending' && <SpendingChart from={from} to={to} />}
          {activeTab === 'sankey' && <SankeyDiagram from={from} to={to} />}
          {activeTab === 'trends' && <SpendingTrendsChart from={from} to={to} />}
        </div>
      </div>
    </div>
  );
}
