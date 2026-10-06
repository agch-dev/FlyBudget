import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { t as translate } from '../../i18n';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Check, ChevronDown, Download, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatCard as StatTile } from '../ui/StatCard';
import {
  MAX_TREND_CATEGORIES,
  TOP_TREND_CATEGORIES,
  useDailyFlow,
  useIncomeVsExpenses,
  useNetWorth,
  useNetWorthSeries,
  useSpendingByCategory,
  useSpendingTrends,
  useTopSpendingCategories,
} from '../../hooks/useReports';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useTransactions } from '../../hooks/useTransactions';
import { usePreferencesStore } from '../../store/preferencesStore';
import { formatCurrency as formatNative } from '../../utils/currency';
import { useViewingMoney } from '../../hooks/useViewingCurrency';
import { breakdownLine } from '../../utils/balanceConversion';
import { convertedNote, totalIn } from '../../utils/conversion';
import { csvFileName, csvRows, downloadCsv, rowsInCurrency } from '../../utils/exportCsv';
import { dayBounds, monthCount } from '../../utils/dateRange';
import { CALENDAR_MONTHS_MAX } from '../../utils/calendarLayout';
import { PayeeIcon } from '../payees/PayeeIcon';
import { TransactionCalendar } from './TransactionCalendar';
import { CATEGORY_COLORS } from '../../utils/chartColors';
import {
  IncomeExpensesChart,
  MonthlySpendingChart,
  NetWorthChart,
  SpendingChart,
  SpendingTrendsChart,
  categoryLabel,
  formatChange,
  netWorthChange,
} from './BuiltinCharts';
import { useSummaryCards } from './BuiltinReport';
import { EXPENSE_COLORS } from './ChartHelpers';
import type { StatCard } from './ChartHelpers';
import type { BuiltinWidgetType } from '../../types';

// The full view of every built-in report has the same parts, top to bottom: four headline
// figures, the chart, and a table of the numbers behind it (which is what Export CSV saves).

const TONE_CLASS = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-text-tertiary',
} as const;

const toneOf = (cents: number): StatCard['tone'] =>
  cents > 0 ? 'positive' : cents < 0 ? 'negative' : 'neutral';

const fullMonth = (month: string) =>
  format(parseISO(`${month}-01`), translate('datePattern.shortMonthYear'));
const percent = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';

interface Column<R> {
  label: string;
  align?: 'left' | 'right';
  cell: (row: R, index: number) => React.ReactNode;
}

interface FooterRow {
  label: string;
  /** One cell per column after the first */
  cells: React.ReactNode[];
}

function BreakdownTable<R>({
  columns,
  rows,
  rowKey,
  footer = [],
  onRowClick,
  selectedKey,
  maxRows,
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  footer?: FooterRow[];
  onRowClick?: (row: R) => void;
  selectedKey?: string | null;
  /** Show only this many rows until "Show all" is clicked */
  maxRows?: number;
}) {
  const { t } = useTranslation('reports');
  const [showAll, setShowAll] = useState(false);
  const align = (c: Column<R>) => (c.align === 'right' ? 'text-right' : 'text-left');
  const shown = maxRows && !showAll ? rows.slice(0, maxRows) : rows;
  if (!rows.length) {
    return (
      <p className="px-4 py-10 text-sm text-center text-text-tertiary">{t('detail.noData')}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-alt border-y border-border">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                className={`px-4 py-2 text-xs font-medium text-text-tertiary whitespace-nowrap ${align(c)}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {shown.map((r, i) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick && (() => onRowClick(r))}
              className={`hover:bg-hover transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${
                selectedKey === rowKey(r) ? 'bg-brand-50' : ''
              }`}
            >
              {columns.map((c, ci) => (
                <td
                  key={c.label}
                  className={`px-4 py-2 whitespace-nowrap ${align(c)} ${
                    ci === 0 ? 'text-text' : 'tabular-nums text-text-secondary'
                  }`}
                >
                  {c.cell(r, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer.length > 0 && (
          <tfoot className="border-t border-border">
            {footer.map((f) => (
              <tr key={f.label}>
                <td className="px-4 py-2 font-semibold text-text">{f.label}</td>
                {f.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={`px-4 py-2 font-semibold tabular-nums text-text whitespace-nowrap ${align(columns[i + 1])}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
      {shown.length < rows.length && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full px-4 py-2.5 text-xs font-medium text-brand-600 hover:bg-hover border-t border-border-light cursor-pointer"
        >
          {t('detail.showAll', { total: rows.length })}
        </button>
      )}
    </div>
  );
}

/** A signed amount colored by sign, for net and change columns. */
function Signed({ cents, children }: { cents: number; children?: React.ReactNode }) {
  const money = useViewingMoney();
  return <span className={TONE_CLASS[toneOf(cents)!]}>{children ?? money.format(cents)}</span>;
}

function Swatch({ color }: { color?: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full mr-2 shrink-0 align-middle"
      style={{ background: color ?? 'var(--color-border)' }}
    />
  );
}

function ShareBar({ part, whole }: { part: number; whole: number }) {
  const pct = whole > 0 ? (part / whole) * 100 : 0;
  return (
    <span className="inline-flex items-center gap-2 justify-end">
      <span className="hidden sm:block w-16 h-1.5 rounded-full bg-surface-alt overflow-hidden">
        <span className="block h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-12 text-right">{percent(part, whole)}</span>
    </span>
  );
}

/** The layout every report detail shares. */
function DetailLayout({
  stats,
  loading,
  chartTitle,
  chartSubtitle,
  chartActions,
  chartHeight = 'h-80',
  chart,
  extra,
  tableTitle,
  table,
  onExport,
}: {
  stats: StatCard[];
  loading: boolean;
  chartTitle: string;
  chartSubtitle?: React.ReactNode;
  chartActions?: React.ReactNode;
  chartHeight?: string;
  chart: React.ReactNode;
  /** Shown between the chart and the table */
  extra?: React.ReactNode;
  tableTitle: string;
  table: React.ReactNode;
  onExport?: () => void;
}) {
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-[72px] bg-surface-alt rounded-lg animate-pulse" />
            ))
          : stats.map((s) => (
              <StatTile
                key={s.label}
                label={s.label}
                value={s.value}
                sub={s.sub}
                valueColor={s.tone ? TONE_CLASS[s.tone] : undefined}
              />
            ))}
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text">{chartTitle}</h3>
            {chartSubtitle && <p className="text-xs text-text-tertiary mt-0.5">{chartSubtitle}</p>}
          </div>
          {chartActions}
        </div>
        <div className={`w-full ${chartHeight}`}>{chart}</div>
      </Card>

      {extra}

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <h3 className="text-sm font-semibold text-text">{tableTitle}</h3>
          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport}>
              <Download size={13} /> {t('detail.exportCsv')}
            </Button>
          )}
        </div>
        {table}
      </Card>
    </div>
  );
}

interface DetailProps {
  from: string;
  to: string;
}

function SummaryDetail({ from, to }: DetailProps) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  const { data = [], isLoading } = useIncomeVsExpenses(from, to);
  const stats = useSummaryCards(from, to);
  const rows = data.map((d) => ({
    month: d.month,
    income: d.income,
    expenses: -d.expenseNet,
    net: d.income + d.expenseNet,
    count: d.expenseCount,
  }));
  const sum = (key: 'income' | 'expenses' | 'net' | 'count') =>
    rows.reduce((s, r) => s + r[key], 0);
  const months = Math.max(rows.length, 1);
  const avg = (key: 'income' | 'expenses' | 'net') => Math.round(sum(key) / months);

  return (
    <DetailLayout
      loading={isLoading}
      stats={stats}
      chartTitle={t('detail.summary.chartTitle')}
      chartSubtitle={t('detail.summary.chartSubtitle')}
      chart={<MonthlySpendingChart from={from} to={to} />}
      tableTitle={t('detail.monthlyBreakdown')}
      onExport={() =>
        downloadCsv(
          csvFileName('summary', from, to),
          rowsInCurrency(
            csvRows(
              rows.map((r) => ({
                month: r.month,
                income_cents: r.income,
                expenses_cents: r.expenses,
                net_cents: r.net,
                transactions: r.count,
              })),
            ),
            money.currency,
          ),
        )
      }
      table={
        <BreakdownTable
          rows={rows}
          rowKey={(r) => r.month}
          columns={[
            { label: t('month'), cell: (r) => fullMonth(r.month) },
            { label: t('income'), align: 'right', cell: (r) => money.format(r.income) },
            { label: t('expenses'), align: 'right', cell: (r) => money.format(r.expenses) },
            { label: t('net'), align: 'right', cell: (r) => <Signed cents={r.net} /> },
            { label: t('transactions'), align: 'right', cell: (r) => r.count },
          ]}
          footer={[
            {
              label: t('total'),
              cells: [
                money.format(sum('income')),
                money.format(sum('expenses')),
                <Signed cents={sum('net')} />,
                sum('count'),
              ],
            },
            {
              label: t('monthlyAverage'),
              cells: [
                money.format(avg('income')),
                money.format(avg('expenses')),
                <Signed cents={avg('net')} />,
                Math.round(sum('count') / months),
              ],
            },
          ]}
        />
      }
    />
  );
}

function NetWorthDetail({ from, to }: DetailProps) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  // The stats follow the chart (daily for short ranges); the table is always month by month
  const { data: series = [], isLoading } = useNetWorthSeries(from, to);
  const { data: monthly = [] } = useNetWorth(from, to);
  const change = netWorthChange(series);
  const last = series[series.length - 1];
  const stats: StatCard[] = [
    {
      label: t('detail.netWorth.stat'),
      value: money.format(change?.latest ?? 0),
      sub: breakdownLine(last?.native, money.currency, last?.leftOut) ?? undefined,
    },
    {
      label: t('detail.change'),
      value: change ? formatChange(change.change, change.percent, money) : money.format(0),
      tone: toneOf(change?.change ?? 0),
    },
    { label: t('assets'), value: money.format(last?.assets ?? 0) },
    { label: t('liabilities'), value: money.format(last?.liabilities ?? 0) },
  ];
  const rows = monthly.map((d, i) => ({
    ...d,
    change: i > 0 ? d.netWorth - monthly[i - 1].netWorth : null,
  }));
  // With money in dollars, the table also says what each month's total is made of
  const hasDollars = [...series, ...monthly].some((d) => d.native?.USD);

  return (
    <DetailLayout
      loading={isLoading}
      stats={stats}
      chartTitle={t('detail.netWorth.chartTitle')}
      chartSubtitle={t('detail.netWorth.chartSubtitle')}
      chartHeight="h-96"
      chart={<NetWorthChart from={from} to={to} />}
      tableTitle={t('detail.netWorth.tableTitle')}
      onExport={() =>
        downloadCsv(
          csvFileName('net-worth', from, to),
          rowsInCurrency(
            csvRows(
              rows.map((r) => ({
                month: r.month,
                assets_cents: r.assets,
                liabilities_cents: r.liabilities,
                net_worth_cents: r.netWorth,
                change_cents: r.change ?? '',
                ...(hasDollars
                  ? { pesos_cents: r.native?.UYU ?? '', dollars_cents: r.native?.USD ?? '' }
                  : {}),
              })),
            ),
            money.currency,
          ),
        )
      }
      table={
        <BreakdownTable
          rows={rows}
          rowKey={(r) => r.month}
          columns={[
            { label: t('month'), cell: (r) => fullMonth(r.month) },
            { label: t('assets'), align: 'right', cell: (r) => money.format(r.assets) },
            { label: t('liabilities'), align: 'right', cell: (r) => money.format(r.liabilities) },
            {
              label: t('netWorth'),
              align: 'right',
              cell: (r) => <span className="text-text">{money.format(r.netWorth)}</span>,
            },
            {
              label: t('detail.change'),
              align: 'right',
              cell: (r) =>
                r.change === null ? (
                  '—'
                ) : (
                  <Signed cents={r.change}>
                    {r.change > 0 ? '+' : ''}
                    {money.format(r.change)}
                  </Signed>
                ),
            },
            ...(hasDollars
              ? [
                  {
                    label: t('detail.netWorth.inPesos'),
                    align: 'right' as const,
                    cell: (r: (typeof rows)[number]) => formatNative(r.native?.UYU ?? 0, 'UYU'),
                  },
                  {
                    label: t('detail.netWorth.inDollars'),
                    align: 'right' as const,
                    cell: (r: (typeof rows)[number]) => formatNative(r.native?.USD ?? 0, 'USD'),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}

function IncomeExpensesDetail({ from, to }: DetailProps) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  const { data = [], isLoading } = useIncomeVsExpenses(from, to);
  const income = data.reduce((s, d) => s + d.income, 0);
  const expenses = data.reduce((s, d) => s + d.expenses, 0);
  const net = income - expenses;
  const months = Math.max(data.length, 1);
  const rate = (i: number, n: number) => (i > 0 ? `${Math.round((n / i) * 100)}%` : '—');
  const stats: StatCard[] = [
    { label: t('income'), value: money.format(income), tone: 'positive' },
    { label: t('expenses'), value: money.format(expenses), tone: 'negative' },
    { label: t('detail.incomeExpenses.netSavings'), value: money.format(net), tone: toneOf(net) },
    {
      label: t('detail.incomeExpenses.savingsRateStat'),
      value: rate(income, net),
      tone: income > 0 ? toneOf(net) : undefined,
    },
  ];

  return (
    <DetailLayout
      loading={isLoading}
      stats={stats}
      chartTitle={t('detail.incomeExpenses.chartTitle')}
      chartSubtitle={t('detail.incomeExpenses.chartSubtitle')}
      chart={<IncomeExpensesChart from={from} to={to} />}
      tableTitle={t('detail.monthlyBreakdown')}
      onExport={() =>
        downloadCsv(
          csvFileName('income-expenses', from, to),
          rowsInCurrency(
            csvRows(
              data.map((d) => ({
                month: d.month,
                income_cents: d.income,
                expenses_cents: d.expenses,
                net_cents: d.net,
              })),
            ),
            money.currency,
          ),
        )
      }
      table={
        <BreakdownTable
          rows={data}
          rowKey={(r) => r.month}
          columns={[
            { label: t('month'), cell: (r) => fullMonth(r.month) },
            { label: t('income'), align: 'right', cell: (r) => money.format(r.income) },
            { label: t('expenses'), align: 'right', cell: (r) => money.format(r.expenses) },
            { label: t('net'), align: 'right', cell: (r) => <Signed cents={r.net} /> },
            { label: t('detail.savingsRate'), align: 'right', cell: (r) => rate(r.income, r.net) },
          ]}
          footer={[
            {
              label: t('total'),
              cells: [
                money.format(income),
                money.format(expenses),
                <Signed cents={net} />,
                rate(income, net),
              ],
            },
            {
              label: t('monthlyAverage'),
              cells: [
                money.format(Math.round(income / months)),
                money.format(Math.round(expenses / months)),
                <Signed cents={Math.round(net / months)} />,
                '',
              ],
            },
          ]}
        />
      }
    />
  );
}

function SpendingDetail({ from, to }: DetailProps) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  const showIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data = [], isLoading } = useSpendingByCategory(from, to);
  const rows = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .map((d) => ({
          ...d,
          id: d.categoryId ?? 'uncategorized',
          label: categoryLabel(
            { name: d.categoryName, icon: d.categoryIcon },
            showIcons,
            t('uncategorized'),
          ),
        })),
    [data, showIcons, t],
  );
  const total = rows.reduce((s, r) => s + r.totalSpent, 0);
  const months = monthCount(from, to);
  const top = rows[0];
  const stats: StatCard[] = [
    { label: t('detail.totalSpent'), value: money.format(total) },
    { label: t('detail.monthlyAverageStat'), value: money.format(Math.round(total / months)) },
    {
      label: t('detail.biggestCategory'),
      value: top ? money.format(top.totalSpent) : '—',
      sub: top?.label,
    },
    { label: t('categories'), value: String(rows.length) },
  ];

  return (
    <DetailLayout
      loading={isLoading}
      stats={stats}
      chartTitle={
        rows.length > 10 ? t('detail.spending.topTitle') : t('detail.spending.chartTitle')
      }
      chartSubtitle={rows.length > 10 ? t('detail.spending.topSubtitle') : undefined}
      chartHeight="h-96"
      chart={<SpendingChart from={from} to={to} />}
      tableTitle={t('detail.spending.tableTitle')}
      onExport={() =>
        downloadCsv(
          csvFileName('spending', from, to),
          rowsInCurrency(
            csvRows(
              rows.map((r) => ({
                category: r.label,
                group: r.groupName ?? '',
                spent_cents: r.totalSpent,
                monthly_average_cents: Math.round(r.totalSpent / months),
              })),
            ),
            money.currency,
          ),
        )
      }
      table={
        <BreakdownTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              label: t('category'),
              // The chart colors its ten bars in this same order
              cell: (r, i) => (
                <span className="inline-flex items-center">
                  <Swatch
                    color={i < 10 ? CATEGORY_COLORS[i % CATEGORY_COLORS.length] : undefined}
                  />
                  {r.label}
                </span>
              ),
            },
            {
              label: t('detail.group'),
              cell: (r) => <span className="text-text-secondary">{r.groupName ?? '—'}</span>,
            },
            { label: t('spent'), align: 'right', cell: (r) => money.format(r.totalSpent) },
            {
              label: t('monthlyAverage'),
              align: 'right',
              cell: (r) => money.format(Math.round(r.totalSpent / months)),
            },
            {
              label: t('detail.share'),
              align: 'right',
              cell: (r) => <ShareBar part={r.totalSpent} whole={total} />,
            },
          ]}
          footer={[
            {
              label: t('total'),
              cells: ['', money.format(total), money.format(Math.round(total / months)), '100%'],
            },
          ]}
        />
      }
    />
  );
}

/** Pick up to MAX_TREND_CATEGORIES spending categories, or go back to the biggest ones. */
function TrendCategoryPicker({
  value,
  auto,
  onChange,
}: {
  value: string[];
  auto: boolean;
  onChange: (ids: string[] | undefined) => void;
}) {
  const { t } = useTranslation('reports');
  const showIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data: groups = [] } = useCategories();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const expenseGroups = groups.filter((g) => g.isIncome === 0 && g.categories.length);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle(id: string) {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    onChange(next.length ? next : undefined);
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
        {t('detail.trends.pick', { selected: value.length })} <ChevronDown size={12} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 max-h-[60vh] overflow-y-auto bg-surface rounded-md border border-border shadow-hover z-30 py-1">
          <button
            onClick={() => onChange(undefined)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-hover transition-colors cursor-pointer"
          >
            <span>
              <span className="block text-sm text-text">{t('detail.trends.biggest')}</span>
              <span className="block text-xs text-text-tertiary">
                {t('detail.trends.biggestHint', { top: TOP_TREND_CATEGORIES })}
              </span>
            </span>
            {auto && <Check size={14} className="text-brand-600 shrink-0" />}
          </button>
          <div className="border-t border-border-light my-1" />
          <p className="px-3 pt-1 pb-1 text-[11px] text-text-tertiary">
            {t('detail.trends.chooseUpTo', { max: MAX_TREND_CATEGORIES })}
          </p>
          {expenseGroups.map((g) => (
            <div key={g.id}>
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                {g.name}
              </p>
              {g.categories.map((c) => {
                const checked = value.includes(c.id);
                const full = !checked && value.length >= MAX_TREND_CATEGORIES;
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                      full
                        ? 'text-text-disabled cursor-not-allowed'
                        : 'text-text-secondary hover:bg-hover cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={full}
                      onChange={() => toggle(c.id)}
                      className="accent-brand-600"
                    />
                    {categoryLabel(c, showIcons)}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpendingTrendsDetail({
  from,
  to,
  categoryIds,
  onCategoryIdsChange,
}: DetailProps & {
  categoryIds: string[] | undefined;
  onCategoryIdsChange: (ids: string[] | undefined) => void;
}) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  const showIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const top = useTopSpendingCategories(from, to, TOP_TREND_CATEGORIES);
  const ids = categoryIds ?? top.ids;
  const { data: groups = [] } = useCategories();
  const { data: spending = [] } = useSpendingByCategory(from, to);
  const { data: trend = [], isLoading } = useSpendingTrends(ids, from, to);
  const months = monthCount(from, to);

  const rows = useMemo(() => {
    const byId = new Map(groups.flatMap((g) => g.categories).map((c) => [c.id, c]));
    return ids.map((id, i) => {
      const points = trend.filter((p) => p.categoryId === id);
      const total = points.reduce((s, p) => s + p.total, 0);
      const peak = points.reduce<(typeof points)[number] | null>(
        (best, p) => (!best || p.total > best.total ? p : best),
        null,
      );
      return {
        id,
        color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
        label: categoryLabel(byId.get(id), showIcons, t('deletedCategory')),
        total,
        peak,
      };
    });
  }, [ids, trend, groups, showIcons, t]);
  const selected = rows.reduce((s, r) => s + r.total, 0);
  const allSpending = spending.reduce((s, d) => s + d.totalSpent, 0);
  const biggest = rows.reduce<(typeof rows)[number] | null>(
    (best, r) => (!best || r.total > best.total ? r : best),
    null,
  );
  const stats: StatCard[] = [
    { label: t('detail.totalSpent'), value: money.format(selected) },
    { label: t('detail.monthlyAverageStat'), value: money.format(Math.round(selected / months)) },
    { label: t('detail.trends.shareStat'), value: percent(selected, allSpending) },
    {
      label: t('detail.biggestCategory'),
      value: biggest && biggest.total > 0 ? money.format(biggest.total) : '—',
      sub: biggest && biggest.total > 0 ? biggest.label : undefined,
    },
  ];
  const auto = !categoryIds;

  return (
    <DetailLayout
      loading={top.isLoading || (ids.length > 0 && isLoading)}
      stats={stats}
      chartTitle={t('detail.trends.chartTitle')}
      chartSubtitle={
        auto
          ? t('detail.trends.auto', { count: ids.length })
          : t('detail.trends.chosen', { count: ids.length })
      }
      chartActions={<TrendCategoryPicker value={ids} auto={auto} onChange={onCategoryIdsChange} />}
      chart={<SpendingTrendsChart from={from} to={to} categoryIds={ids} />}
      tableTitle={t('detail.trends.tableTitle')}
      onExport={() =>
        downloadCsv(
          csvFileName('spending-trends', from, to),
          rowsInCurrency(
            csvRows(
              [...trend]
                .sort((a, b) => a.month.localeCompare(b.month))
                .map((p) => ({
                  month: p.month,
                  category: rows.find((r) => r.id === p.categoryId)?.label ?? '',
                  spent_cents: p.total,
                })),
            ),
            money.currency,
          ),
        )
      }
      table={
        <BreakdownTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              label: t('category'),
              cell: (r) => (
                <span className="inline-flex items-center">
                  <Swatch color={r.color} />
                  {r.label}
                </span>
              ),
            },
            { label: t('spent'), align: 'right', cell: (r) => money.format(r.total) },
            {
              label: t('monthlyAverage'),
              align: 'right',
              cell: (r) => money.format(Math.round(r.total / months)),
            },
            {
              label: t('detail.trends.highestMonth'),
              align: 'right',
              cell: (r) =>
                r.peak ? `${money.format(r.peak.total)} (${fullMonth(r.peak.month)})` : '—',
            },
            {
              label: t('detail.trends.shareOfAll'),
              align: 'right',
              cell: (r) => <ShareBar part={r.total} whole={allSpending} />,
            },
          ]}
          footer={[
            {
              label: t('total'),
              cells: [
                money.format(selected),
                money.format(Math.round(selected / months)),
                '',
                percent(selected, allSpending),
              ],
            },
          ]}
        />
      }
    />
  );
}

/** Transactions on one day of the calendar, counted the same way (budget accounts, no transfers). */
function DayTransactions({ day, onClose }: { day: string; onClose: () => void }) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  const showIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data = [], isLoading } = useTransactions({ from: day, to: day, limit: 1000 });
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useCategories();
  const { data: payees = [] } = usePayees();
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(
    () => new Map(groups.flatMap((g) => g.categories).map((c) => [c.id, c])),
    [groups],
  );
  const logos = useMemo(() => new Map(payees.map((p) => [p.id, p.logo])), [payees]);
  const rows = data.filter(
    (tx) => !tx.transferTransactionId && accountsById.get(tx.accountId)?.isOffBudget === 0,
  );
  // Like the calendar's totals: in the viewing currency, transactions in the other one at the
  // rate of their date. Each row below keeps its native amount.
  const moneyIn = totalIn(rows, money.currency, (cents) => Math.max(cents, 0));
  const moneyOut = totalIn(rows, money.currency, (cents) => -Math.min(cents, 0));

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-text">
            {format(parseISO(day), t('datePattern.weekdayLongDate', { ns: 'common' }))}
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5 tabular-nums">
            {t('transactionCount', { count: rows.length })}
            {moneyIn > 0 && (
              <span className="text-positive">
                {' · '}
                {t('detail.calendar.dayIn', { amount: money.format(moneyIn) })}
              </span>
            )}
            {moneyOut > 0 && (
              <span className="text-negative">
                {' · '}
                {t('detail.calendar.dayOut', { amount: money.format(moneyOut) })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t('ui.close', { ns: 'common' })}
          className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-hover transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>
      {isLoading ? (
        <div className="h-24 px-5 pb-4">
          <div className="h-full bg-surface-alt rounded animate-pulse" />
        </div>
      ) : (
        <BreakdownTable
          rows={rows}
          rowKey={(tx) => tx.id}
          columns={[
            {
              label: t('payee'),
              cell: (tx) => (
                <span className="inline-flex items-center gap-2">
                  <PayeeIcon
                    name={tx.payeeName ?? ''}
                    logo={tx.payeeId ? logos.get(tx.payeeId) : null}
                    size="sm"
                  />
                  {tx.payeeName || (
                    <span className="text-text-tertiary">{t('detail.calendar.noPayee')}</span>
                  )}
                </span>
              ),
            },
            {
              label: t('category'),
              cell: (tx) => (
                <span className="text-text-secondary">
                  {tx.isParent
                    ? t('detail.calendar.split', { parts: tx.children?.length ?? 0 })
                    : tx.categoryId
                      ? categoryLabel(categoriesById.get(tx.categoryId), showIcons)
                      : t('uncategorized')}
                </span>
              ),
            },
            {
              label: t('account'),
              cell: (tx) => (
                <Link
                  to={`/accounts/${tx.accountId}`}
                  className="text-text-secondary hover:text-brand-600 transition-colors"
                >
                  {accountsById.get(tx.accountId)?.name ?? ''}
                </Link>
              ),
            },
            {
              label: t('amount'),
              align: 'right',
              cell: (tx) => (
                <span
                  className={tx.amount > 0 ? 'text-positive' : 'text-text'}
                  title={convertedNote(tx, money.currency) ?? undefined}
                >
                  {tx.amount > 0 && '+'}
                  {formatNative(tx.amount, tx.currency)}
                </span>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}

function CalendarDetail({ from, to }: DetailProps) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  const { data = [], isLoading } = useDailyFlow(from, to);
  const [selected, setSelected] = useState<string | null>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const moneyIn = data.reduce((s, d) => s + d.income, 0);
  const moneyOut = data.reduce((s, d) => s + d.expenses, 0);
  const net = moneyIn - moneyOut;
  // Days so far, from the first transaction ("All time" starts years early) up to today
  const bounds = dayBounds(from, to);
  if (data.length && data[0].date > bounds.from) bounds.from = data[0].date;
  const days = Math.max(
    0,
    differenceInCalendarDays(parseISO(bounds.to), parseISO(bounds.from)) + 1,
  );
  const stats: StatCard[] = [
    { label: t('detail.calendar.moneyInStat'), value: money.format(moneyIn), tone: 'positive' },
    { label: t('detail.calendar.moneyOutStat'), value: money.format(moneyOut), tone: 'negative' },
    { label: t('net'), value: money.format(net), tone: toneOf(net) },
    {
      label: t('detail.calendar.dailyAverageOut'),
      value: money.format(days ? Math.round(moneyOut / days) : 0),
      sub: days ? t('detail.calendar.overDays', { count: days }) : undefined,
    },
  ];
  const rows = [...data].reverse();

  function select(day: string) {
    setSelected((cur) => (cur === day ? null : day));
    // Bring the day's transactions into view once they render
    requestAnimationFrame(() =>
      dayRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  }

  return (
    <DetailLayout
      loading={isLoading}
      stats={stats}
      chartTitle={t('detail.calendar.chartTitle')}
      chartSubtitle={
        monthCount(from, to) > CALENDAR_MONTHS_MAX
          ? t('detail.calendar.heatmapSubtitle')
          : t('detail.calendar.gridSubtitle')
      }
      chartHeight=""
      chart={<TransactionCalendar from={from} to={to} selected={selected} onSelect={select} />}
      extra={
        selected && (
          <div ref={dayRef} className="scroll-mt-4">
            <DayTransactions day={selected} onClose={() => setSelected(null)} />
          </div>
        )
      }
      tableTitle={t('detail.calendar.tableTitle')}
      onExport={() =>
        downloadCsv(
          csvFileName('calendar', from, to),
          rowsInCurrency(
            csvRows(
              data.map((d) => ({
                date: d.date,
                transactions: d.count,
                money_in_cents: d.income,
                money_out_cents: d.expenses,
                net_cents: d.income - d.expenses,
              })),
            ),
            money.currency,
          ),
        )
      }
      table={
        <BreakdownTable
          rows={rows}
          rowKey={(r) => r.date}
          maxRows={31}
          selectedKey={selected}
          onRowClick={(r) => select(r.date)}
          columns={[
            {
              label: t('detail.date'),
              cell: (r) => format(parseISO(r.date), t('datePattern.weekdayDate', { ns: 'common' })),
            },
            { label: t('transactions'), align: 'right', cell: (r) => r.count },
            {
              label: t('detail.calendar.moneyIn'),
              align: 'right',
              cell: (r) => money.format(r.income),
            },
            {
              label: t('detail.calendar.moneyOut'),
              align: 'right',
              cell: (r) => money.format(r.expenses),
            },
            {
              label: t('net'),
              align: 'right',
              cell: (r) => <Signed cents={r.income - r.expenses} />,
            },
          ]}
          footer={[
            {
              label: t('total'),
              cells: [
                data.reduce((s, d) => s + d.count, 0),
                money.format(moneyIn),
                money.format(moneyOut),
                <Signed cents={net} />,
              ],
            },
          ]}
        />
      }
    />
  );
}

/** The full view of a built-in report: headline figures, chart and breakdown table. */
export function ReportDetail({
  type,
  from,
  to,
  categoryIds,
  onCategoryIdsChange,
}: {
  type: BuiltinWidgetType;
  from: string;
  to: string;
  /** Spending Trends only: the chosen categories (undefined = the biggest ones) */
  categoryIds?: string[];
  onCategoryIdsChange: (ids: string[] | undefined) => void;
}) {
  switch (type) {
    case 'summary':
      return <SummaryDetail from={from} to={to} />;
    case 'net-worth':
      return <NetWorthDetail from={from} to={to} />;
    case 'income-expenses':
      return <IncomeExpensesDetail from={from} to={to} />;
    case 'spending':
      return <SpendingDetail from={from} to={to} />;
    case 'calendar':
      return <CalendarDetail from={from} to={to} />;
    case 'spending-trends':
      return (
        <SpendingTrendsDetail
          from={from}
          to={to}
          categoryIds={categoryIds}
          onCategoryIdsChange={onCategoryIdsChange}
        />
      );
  }
}
