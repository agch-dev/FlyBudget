import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TOP_TREND_CATEGORIES,
  useIncomeVsExpenses,
  useTopSpendingCategories,
} from '../../hooks/useReports';
import { useViewingMoney } from '../../hooks/useViewingCurrency';
import { expenseFigure, incomeFigure, monthsToAverage } from '../../utils/reportSummary';
import {
  NetWorthChart,
  IncomeExpensesChart,
  SpendingChart,
  SpendingTrendsChart,
} from './BuiltinCharts';
import { TransactionCalendar } from './TransactionCalendar';
import { ChartSkeleton } from './ChartHelpers';
import type { StatCard } from './ChartHelpers';
import type { BuiltinWidgetType } from '../../types';

/**
 * The built-in reports, in the order "Add widget" lists them. Their names and descriptions are
 * in the catalog (`reports:builtin.<type>.label` and `.description`).
 */
export const BUILTIN_TYPES: BuiltinWidgetType[] = [
  'summary',
  'net-worth',
  'income-expenses',
  'spending',
  'spending-trends',
  'calendar',
];

/**
 * Totals for the range. Expenses show what was spent (red), or "+$X" in green when refunds
 * outweighed spending. The monthly average counts only months since the budget's first
 * activity in the range.
 */
export function useSummaryCards(from: string, to: string): StatCard[] {
  const { t } = useTranslation('reports');
  const { data: ieData = [] } = useIncomeVsExpenses(from, to);
  const money = useViewingMoney();
  return useMemo(() => {
    const totalInc = ieData.reduce((s, d) => s + d.income, 0);
    const expNet = ieData.reduce((s, d) => s + d.expenseNet, 0);
    const txCount = ieData.reduce((s, d) => s + d.expenseCount, 0);
    return [
      { label: t('summary.totalIncome'), ...incomeFigure(totalInc, money) },
      { label: t('summary.totalExpenses'), ...expenseFigure(expNet, money) },
      {
        label: t('summary.avgMonthlyExpenses'),
        ...expenseFigure(expNet / monthsToAverage(ieData), money),
      },
      {
        label: t('summary.avgPerTransaction'),
        ...expenseFigure(txCount > 0 ? expNet / txCount : 0, money),
      },
    ];
  }, [ieData, money, t]);
}

const TONE_CLASS = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-text-tertiary',
};

/**
 * The summary widget: four figures in a row next to the title on a wide card (the card is the
 * @container, see WidgetCard), two by two under it otherwise.
 */
function SummaryTiles({ from, to }: { from: string; to: string }) {
  const cards = useSummaryCards(from, to);
  return (
    <div className="h-full grid grid-cols-2 @4xl:grid-cols-4 gap-x-3 gap-y-2 content-center">
      {cards.map((c) => (
        <div key={c.label} className="text-center min-w-0">
          {/* A size down on narrow cards (a phone), so "$12,345.67" fits two to a row */}
          <p
            className={`text-lg @sm:text-xl font-semibold tabular-nums break-words ${c.tone ? TONE_CLASS[c.tone] : 'text-text'}`}
          >
            {c.value}
          </p>
          <p className="text-xs text-text-secondary mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Spending Trends on a dashboard: the widget's chosen categories, or else the
 * TOP_TREND_CATEGORIES with the most spending in the range.
 */
function DashboardSpendingTrends({
  from,
  to,
  categoryIds,
}: {
  from: string;
  to: string;
  categoryIds?: string[];
}) {
  const { t } = useTranslation('reports');
  const top = useTopSpendingCategories(from, to, TOP_TREND_CATEGORIES);
  const ids = categoryIds ?? top.ids;
  if (!categoryIds && top.isLoading) return <ChartSkeleton />;
  const caption = categoryIds ? undefined : t('chart.biggestCategories', { count: ids.length });
  return <SpendingTrendsChart from={from} to={to} categoryIds={ids} caption={caption} />;
}

/** A built-in report as its dashboard widget shows it (the full view is in ReportDetail). */
export function BuiltinReportChart({
  type,
  from,
  to,
  categoryIds,
}: {
  type: BuiltinWidgetType;
  from: string;
  to: string;
  /** Spending Trends: the categories to chart (undefined = the biggest ones) */
  categoryIds?: string[];
}) {
  switch (type) {
    case 'summary':
      return <SummaryTiles from={from} to={to} />;
    case 'net-worth':
      return <NetWorthChart from={from} to={to} headline />;
    case 'income-expenses':
      return <IncomeExpensesChart from={from} to={to} />;
    case 'spending':
      return <SpendingChart from={from} to={to} />;
    case 'calendar':
      return <TransactionCalendar from={from} to={to} fit />;
    case 'spending-trends':
      return <DashboardSpendingTrends from={from} to={to} categoryIds={categoryIds} />;
  }
}
