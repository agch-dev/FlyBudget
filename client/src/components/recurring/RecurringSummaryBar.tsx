import { formatCurrency } from '../../utils/currency';
import type { RecurringSummary } from '../../types';

interface Props {
  summary: RecurringSummary | undefined;
  isLoading: boolean;
}

export default function RecurringSummaryBar({ summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex gap-4 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-16 bg-white rounded-xl shadow-sm animate-pulse" />
        ))}
      </div>
    );
  }

  const income = summary?.income ?? 0;
  const expenses = summary?.expenses ?? 0;
  const net = income + expenses;

  const cards = [
    { label: 'Expected Income', value: formatCurrency(income), color: 'text-emerald-600', accent: 'border-l-emerald-500' },
    { label: 'Expected Expenses', value: formatCurrency(expenses), color: 'text-gray-800', accent: 'border-l-red-400' },
    { label: 'Net', value: formatCurrency(net), color: net >= 0 ? 'text-emerald-600' : 'text-red-600', accent: '' },
  ];

  return (
    <div className="flex gap-4 mb-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`flex-1 bg-white rounded-xl shadow-sm p-4 ${c.accent ? `border-l-4 ${c.accent}` : ''}`}
        >
          <p className="text-xs font-medium text-gray-500">{c.label}</p>
          <p className={`text-lg font-bold tabular-nums mt-0.5 ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
