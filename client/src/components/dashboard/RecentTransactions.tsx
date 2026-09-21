import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import { Card } from '../ui/Card';

export default function RecentTransactions() {
  const { data: transactions = [], isLoading: txLoading } = useTransactions({ limit: 8 });
  const { data: categoryGroups = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null }>();
    for (const g of categoryGroups) {
      for (const c of g.categories) {
        map.set(c.id, { name: c.name, icon: c.icon });
      }
    }
    return map;
  }, [categoryGroups]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) map.set(a.id, a.name);
    return map;
  }, [accounts]);

  if (txLoading) {
    return (
      <Card>
        <div className="h-5 w-40 bg-surface-alt rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">Recent Transactions</h3>
        <Link to="/transactions" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View all</Link>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-text-disabled py-4 text-center">No transactions yet.</p>
      ) : (
        <div className="divide-y divide-border-light">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-3 py-2">
              <span className="text-xs text-text-tertiary w-12 shrink-0 tabular-nums">
                {format(parseISO(tx.date), 'MMM d')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{tx.payeeName || 'No payee'}</p>
                <p className="text-xs text-text-tertiary truncate">
                  {tx.categoryId ? (() => { const e = categoryMap.get(tx.categoryId!); return e ? `${e.icon ? e.icon + ' ' : ''}${e.name}` : 'Uncategorized'; })() : 'Uncategorized'}
                  {' · '}
                  {accountMap.get(tx.accountId) || ''}
                </p>
              </div>
              <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${tx.amount > 0 ? 'text-positive' : 'text-text'}`}>
                {formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
