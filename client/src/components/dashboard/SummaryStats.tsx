import { useBudgetSummary } from '../../hooks/useBudget';
import { useNetWorth, useIncomeVsExpenses } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';

interface Props {
  currentMonth: string;
  sixMonthsAgo: string;
}

export default function SummaryStats({ currentMonth, sixMonthsAgo }: Props) {
  const { data: summary, isLoading: summaryLoading } = useBudgetSummary(currentMonth);
  const { data: netWorthData = [], isLoading: nwLoading } = useNetWorth(sixMonthsAgo, currentMonth);
  const { data: ieData = [], isLoading: ieLoading } = useIncomeVsExpenses(currentMonth, currentMonth);

  const isLoading = summaryLoading || nwLoading || ieLoading;

  if (isLoading) {
    return (
      <div className="flex gap-4 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[140px] h-[88px] bg-white rounded-xl shadow-sm animate-pulse" />
        ))}
      </div>
    );
  }

  const latestNetWorth = netWorthData.length > 0 ? netWorthData[netWorthData.length - 1].netWorth : 0;
  const toBeBudgeted = summary?.toBeBudgeted ?? 0;
  const income = ieData.length > 0 ? ieData[0].income : 0;
  const expenses = ieData.length > 0 ? ieData[0].expenses : 0;
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  const tbbColor = toBeBudgeted > 0 ? 'border-l-emerald-500' : toBeBudgeted < 0 ? 'border-l-red-500' : 'border-l-amber-400';
  const tbbTextColor = toBeBudgeted > 0 ? 'text-emerald-700' : toBeBudgeted < 0 ? 'text-red-600' : 'text-amber-600';

  const cards = [
    { label: 'Net Worth', value: formatCurrency(latestNetWorth), accent: '' },
    { label: 'To Be Budgeted', value: formatCurrency(toBeBudgeted), accent: tbbColor, valueColor: tbbTextColor },
    { label: 'Income', value: formatCurrency(income), accent: '', valueColor: 'text-emerald-700' },
    { label: 'Expenses', value: formatCurrency(expenses), accent: '' },
    { label: 'Savings Rate', value: `${savingsRate}%`, accent: '', valueColor: savingsRate > 0 ? 'text-emerald-700' : savingsRate < 0 ? 'text-red-600' : '' },
  ];

  return (
    <div className="flex gap-4 flex-wrap">
      {cards.map(c => (
        <div
          key={c.label}
          className={`flex-1 min-w-[140px] bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 ${c.accent ? `border-l-4 ${c.accent}` : 'border border-white'}`}
        >
          <p className="text-xs font-medium text-gray-500">{c.label}</p>
          <p className={`text-xl font-bold tabular-nums mt-1 ${c.valueColor || 'text-gray-900'}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
