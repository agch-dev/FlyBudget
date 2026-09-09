import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBudget } from '../../hooks/useBudget';
import { formatCurrency } from '../../utils/currency';
import { Card } from '../ui/Card';

interface Props {
  currentMonth: string;
}

export default function BudgetProgress({ currentMonth }: Props) {
  const { data: groups = [], isLoading } = useBudget(currentMonth);

  const topCategories = useMemo(() => {
    const cats = groups
      .filter(g => !g.isIncome)
      .flatMap(g => g.categories)
      .filter(c => c.budgeted > 0);

    return cats
      .sort((a, b) => {
        const aOver = a.balance < 0 ? 1 : 0;
        const bOver = b.balance < 0 ? 1 : 0;
        if (aOver !== bOver) return bOver - aOver;
        return (b.spent / b.budgeted) - (a.spent / a.budgeted);
      })
      .slice(0, 6);
  }, [groups]);

  if (isLoading) {
    return (
      <Card>
        <div className="h-5 w-40 bg-surface-alt rounded animate-pulse mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 bg-surface-alt rounded animate-pulse mb-1" style={{ width: `${60 + i * 5}%` }} />
              <div className="h-1.5 bg-surface-alt rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">Budget Progress</h3>
        <Link to="/budget" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View all</Link>
      </div>

      {topCategories.length === 0 ? (
        <p className="text-sm text-text-disabled py-4 text-center">No budgeted categories this month.</p>
      ) : (
        <div className="space-y-3">
          {topCategories.map(cat => {
            const ratio = Math.min(cat.spent / cat.budgeted, 1);
            const color = ratio >= 1 ? 'bg-negative' : ratio >= 0.8 ? 'bg-caution' : 'bg-positive';

            return (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm text-text-secondary truncate mr-2">{cat.name}</span>
                  <span className="text-xs text-text-tertiary tabular-nums whitespace-nowrap">
                    {formatCurrency(cat.spent)} / {formatCurrency(cat.budgeted)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-alt rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${(ratio * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
