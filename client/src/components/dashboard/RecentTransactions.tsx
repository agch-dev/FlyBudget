import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';

export default function RecentTransactions() {
  const { data: transactions = [], isLoading: txLoading } = useTransactions({ limit: 8 });
  const { data: categoryGroups = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of categoryGroups) {
      for (const c of g.categories) {
        map.set(c.id, c.name);
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
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
        <Link to="/transactions" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No transactions yet.</p>
      ) : (
        <div className="space-y-1">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-3 py-1.5">
              <span className="text-xs text-gray-400 w-12 shrink-0 tabular-nums">
                {format(parseISO(tx.date), 'MMM d')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{tx.payeeName || 'No payee'}</p>
                <p className="text-xs text-gray-400 truncate">
                  {tx.categoryId ? categoryMap.get(tx.categoryId) || 'Uncategorized' : 'Uncategorized'}
                  {' · '}
                  {accountMap.get(tx.accountId) || ''}
                </p>
              </div>
              <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                {formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
