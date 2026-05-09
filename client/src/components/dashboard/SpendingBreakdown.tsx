import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSpendingByCategory } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';

const COLORS = ['#f59e0b', '#ef4444', '#f97316', '#06b6d4', '#6366f1', '#ec4899', '#84cc16', '#0ea5e9'];

interface Props {
  currentMonth: string;
}

export default function SpendingBreakdown({ currentMonth }: Props) {
  const { data = [], isLoading } = useSpendingByCategory(currentMonth, currentMonth);

  const topCategories = useMemo(() => {
    return data
      .filter(c => c.totalSpent < 0)
      .sort((a, b) => a.totalSpent - b.totalSpent)
      .slice(0, 8)
      .map(c => ({ ...c, amount: Math.abs(c.totalSpent) }));
  }, [data]);

  const maxAmount = topCategories.length > 0 ? topCategories[0].amount : 1;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" style={{ width: `${90 - i * 8}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Spending by Category</h3>
        <Link to="/reports/spending" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
      </div>

      {topCategories.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No spending this month.</p>
      ) : (
        <div className="space-y-2.5">
          {topCategories.map((cat, i) => {
            const pct = (cat.amount / maxAmount) * 100;
            const color = COLORS[i % COLORS.length];
            return (
              <div key={cat.categoryId ?? i}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm text-gray-700 truncate mr-2">{cat.categoryName || 'Uncategorized'}</span>
                  <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{formatCurrency(-cat.amount)}</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
