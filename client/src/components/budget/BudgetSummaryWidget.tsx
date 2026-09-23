import { useState } from 'react';
import { formatCurrency } from '../../utils/currency';

interface BudgetSummaryWidgetProps {
  toBeBudgeted: number;
  carryOver: number;
  incomePlanned: number;
  incomeEarned: number;
  expensesPlanned: number;
  expensesSpent: number;
  savingsPlanned: number;
  savingsContributed: number;
}

function getHeroStyle(tbb: number, incomePlanned: number) {
  if (tbb < 0) return { bg: 'bg-negative-subtle', text: 'text-negative', label: 'Over budget' };
  if (tbb === 0) return { bg: 'bg-positive-subtle', text: 'text-positive', label: 'Fully budgeted' };
  const threshold = Math.max(incomePlanned * 0.02, 500);
  if (tbb <= threshold) return { bg: 'bg-caution-subtle', text: 'text-caution', label: 'Almost budgeted' };
  return { bg: 'bg-positive-subtle', text: 'text-positive', label: 'Left to budget' };
}

function getBarColor(actual: number, planned: number, type: 'income' | 'expenses' | 'savings') {
  if (type === 'income' || type === 'savings') return 'bg-positive';
  if (planned <= 0) return 'bg-positive';
  const ratio = actual / planned;
  if (ratio > 1) return 'bg-negative';
  if (ratio >= 0.8) return 'bg-caution';
  return 'bg-positive';
}

interface SummarySectionProps {
  label: string;
  planned: number;
  actual: number;
  actualLabel: string;
  type: 'income' | 'expenses' | 'savings';
}

function SummarySection({ label, planned, actual, actualLabel, type }: SummarySectionProps) {
  const remaining = planned - actual;
  const ratio = planned > 0 ? Math.min(actual / planned, 1) : 0;
  const barColor = getBarColor(actual, planned, type);
  const remainingColor = remaining >= 0 ? 'text-positive' : 'text-negative';

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">{label}</span>
        <span className="text-sm tabular-nums text-text-tertiary">
          {formatCurrency(planned)} planned
        </span>
      </div>

      <div className="h-3 w-full bg-surface-alt rounded-full overflow-hidden mt-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${(ratio * 100).toFixed(1)}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between mt-2">
        <span className="text-sm font-semibold tabular-nums text-text">
          {formatCurrency(actual)} <span className="font-normal text-text-secondary">{actualLabel}</span>
        </span>
        <span className={`text-sm font-medium tabular-nums ${remainingColor}`}>
          {formatCurrency(remaining)} <span className="font-normal">remaining</span>
        </span>
      </div>
    </div>
  );
}

type Tab = 'summary' | 'income' | 'expenses';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'income', label: 'Income' },
  { key: 'expenses', label: 'Expenses' },
];

export function BudgetSummaryWidget({
  toBeBudgeted,
  carryOver,
  incomePlanned,
  incomeEarned,
  expensesPlanned,
  expensesSpent,
  savingsPlanned,
  savingsContributed,
}: BudgetSummaryWidgetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const hero = getHeroStyle(toBeBudgeted, incomePlanned);

  return (
    <div className="rounded-lg shadow-card border border-border-light overflow-hidden bg-surface">
      <div className="p-3">
        <div className={`${hero.bg} rounded-lg px-4 py-3 text-center`}>
          <p className={`text-lg font-semibold tabular-nums ${hero.text}`}>
            {formatCurrency(toBeBudgeted)}
          </p>
          <p className={`text-xs ${hero.text} mt-0.5 opacity-75`}>
            {hero.label}
          </p>
          {carryOver !== 0 && (
            <p className="text-[11px] text-text-tertiary mt-0.5">
              Includes {formatCurrency(carryOver)} carry over
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-4 px-4 pb-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-1.5 text-xs transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'border-text text-text font-semibold'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-2">
        {activeTab === 'summary' && (
          <div>
            <SummarySection
              label="Income"
              planned={incomePlanned}
              actual={incomeEarned}
              actualLabel="earned"
              type="income"
            />
            <div className="border-t border-border-light" />
            <SummarySection
              label="Expenses"
              planned={expensesPlanned}
              actual={expensesSpent}
              actualLabel="spent"
              type="expenses"
            />
            {savingsPlanned > 0 && (
              <>
                <div className="border-t border-border-light" />
                <SummarySection
                  label="Save up"
                  planned={savingsPlanned}
                  actual={savingsContributed}
                  actualLabel="contributed"
                  type="savings"
                />
              </>
            )}
          </div>
        )}
        {activeTab === 'income' && (
          <SummarySection
            label="Income"
            planned={incomePlanned}
            actual={incomeEarned}
            actualLabel="earned"
            type="income"
          />
        )}
        {activeTab === 'expenses' && (
          <SummarySection
            label="Expenses"
            planned={expensesPlanned}
            actual={expensesSpent}
            actualLabel="spent"
            type="expenses"
          />
        )}
      </div>
    </div>
  );
}
