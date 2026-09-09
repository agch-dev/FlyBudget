import { useBudgetSummary } from '../../hooks/useBudget';
import { useIncomeVsExpenses } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';
import { StatCard } from '../ui/StatCard';

interface Props {
  currentMonth: string;
  sixMonthsAgo: string;
}

export default function SummaryStats({ currentMonth }: Props) {
  const { data: summary, isLoading: summaryLoading } = useBudgetSummary(currentMonth);
  const { data: ieData = [], isLoading: ieLoading } = useIncomeVsExpenses(currentMonth, currentMonth);

  const isLoading = summaryLoading || ieLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[72px] bg-surface-alt rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const toBeBudgeted = summary?.toBeBudgeted ?? 0;
  const income = ieData.length > 0 ? ieData[0].income : 0;
  const expenses = ieData.length > 0 ? ieData[0].expenses : 0;
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  const tbbAccent = toBeBudgeted > 0 ? 'positive' as const : toBeBudgeted < 0 ? 'negative' as const : undefined;
  const tbbColor = toBeBudgeted > 0 ? 'text-positive' : toBeBudgeted < 0 ? 'text-negative' : undefined;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="To Be Budgeted"
        value={formatCurrency(toBeBudgeted)}
        accent={tbbAccent}
        valueColor={tbbColor}
      />
      <StatCard
        label="Income"
        value={formatCurrency(income)}
        valueColor="text-positive"
      />
      <StatCard
        label="Expenses"
        value={formatCurrency(expenses)}
      />
      <StatCard
        label="Savings Rate"
        value={`${savingsRate}%`}
        valueColor={savingsRate > 0 ? 'text-positive' : savingsRate < 0 ? 'text-negative' : undefined}
      />
    </div>
  );
}
