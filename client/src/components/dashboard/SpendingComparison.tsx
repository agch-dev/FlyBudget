import { useState, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useSpendingComparison } from '../../hooks/useReports';
import { currencySymbol } from '../../utils/currency';
import { HOME_CURRENCY } from '../../types';
import { useViewingMoney } from '../../hooks/useViewingCurrency';
import { TrendingDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { chartColors } from '../../utils/chartColors';
import { useXAxisLayout } from '../../hooks/useXAxisLayout';
import { COMPARISON_MODES, comparisonLabels, type ComparisonMode } from '../../utils/reportText';

/** Compact axis label with the currency's sign: "$950", "US$1.5K" */
function formatYAxis(value: number, sign: string): string {
  const dollars = Math.abs(value) / 100;
  if (dollars >= 1000) {
    const k = dollars / 1000;
    return `${sign}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${sign}${dollars.toFixed(0)}`;
}

function ComparisonTooltip({ active, payload, label }: any) {
  const money = useViewingMoney();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg shadow-hover px-3 py-2">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      {payload.map(
        (p: any) =>
          p.value != null && (
            <p
              key={p.dataKey}
              className="text-xs font-medium"
              style={{ color: p.stroke || p.color }}
            >
              {p.name}: {money.format(p.value)}
            </p>
          ),
      )}
    </div>
  );
}

export default function SpendingComparison() {
  const { t, i18n } = useTranslation('reports');
  const money = useViewingMoney();
  const [mode, setMode] = useState<ComparisonMode>('month_vs_last_month');
  const { data, isLoading } = useSpendingComparison(mode);
  // The periods' names in the App Language (the server's own are English)
  const labels = comparisonLabels(mode);
  const language = i18n.language;

  const chartData = useMemo(() => {
    if (!data) return [];
    const merged: Record<
      number,
      { day: number; label: string; current?: number; comparison?: number }
    > = {};

    for (let day = 1; day <= data.maxDays; day++) {
      merged[day] = { day, label: t('home.comparison.day', { day }) };
    }

    for (const pt of data.current) {
      if (merged[pt.day]) merged[pt.day].current = pt.cumulative;
    }
    for (const pt of data.comparison) {
      if (merged[pt.day]) merged[pt.day].comparison = pt.cumulative;
    }

    return Object.values(merged).sort((a, b) => a.day - b.day);
  }, [data, t, language]);

  const hasData =
    !!data &&
    (data.current.some((p) => p.cumulative !== 0) ||
      data.comparison.some((p) => p.cumulative !== 0));

  const dayLabels = useMemo(() => chartData.map((d) => d.label), [chartData]);
  // "US$1.5K" is wider than "$1.5K"
  const axisWidth = money.currency === HOME_CURRENCY ? 50 : 64;
  // Inset: y-axis width on the left, chart margin (8) on the right
  const xAxis = useXAxisLayout({
    labels: dayLabels,
    kind: 'point',
    ordered: true,
    fontSize: 11,
    inset: { left: axisWidth, right: 8 },
  });

  if (isLoading || !data) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-36 bg-surface-alt rounded animate-pulse" />
          <div className="h-8 w-44 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="h-4 w-28 bg-surface-alt rounded animate-pulse mb-3" />
        <div className="h-48 bg-surface-alt rounded animate-pulse" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-text">
            <Trans
              t={t}
              i18nKey={`home.comparison.heading.${labels.period}`}
              values={{ amount: money.format(data.currentTotal) }}
              components={{
                figure: <span className="text-text-secondary font-normal tabular-nums" />,
              }}
            />
          </h3>
        </div>
        <select
          aria-label={t('home.comparison.modeLabel')}
          value={mode}
          onChange={(e) => setMode(e.target.value as ComparisonMode)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface text-text cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-600 min-w-0 max-w-[200px]"
        >
          {COMPARISON_MODES.map((m) => (
            <option key={m} value={m}>
              {t(`home.comparison.mode.${m}`)}
            </option>
          ))}
        </select>
      </div>

      {hasData && chartData.length > 0 ? (
        <div className="mt-2" ref={xAxis.ref}>
          <ResponsiveContainer width="100%" height={192}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gSpendingCur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.brand} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={chartColors.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" axisLine={false} tickLine={false} {...xAxis.axisProps} />
              <YAxis
                tick={{ fontSize: 11, fill: chartColors.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) =>
                  formatYAxis(value, currencySymbol(money.currency))
                }
                width={axisWidth}
              />
              <Tooltip content={<ComparisonTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: chartColors.axis }} />
              <Line
                type="monotone"
                dataKey="comparison"
                name={labels.comparison}
                stroke="#9CA3AF"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="current"
                name={labels.current}
                stroke={chartColors.brand}
                strokeWidth={2}
                fill="url(#gSpendingCur)"
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          compact
          icon={<TrendingDown size={20} />}
          title={t('home.comparison.emptyTitle')}
          description={t('home.comparison.emptyDescription')}
        />
      )}
    </Card>
  );
}
