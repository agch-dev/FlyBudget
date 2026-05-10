import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import type { Account, AccountType } from '../../types';

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Cards',
  cash: 'Cash',
  investment: 'Investments',
};

const TYPE_ORDER: AccountType[] = ['checking', 'savings', 'cash', 'credit', 'investment'];

export default function AccountsOverview() {
  const { data: accounts = [], isLoading } = useAccounts();

  const grouped = useMemo(() => {
    const open = accounts.filter(a => !a.closedAt);
    const groups = new Map<AccountType, Account[]>();
    for (const a of open) {
      const list = groups.get(a.type) || [];
      list.push(a);
      groups.set(a.type, list);
    }
    return TYPE_ORDER
      .filter(t => groups.has(t))
      .map(t => ({ type: t, label: TYPE_LABELS[t], accounts: groups.get(t)! }));
  }, [accounts]);

  const totals = useMemo(() => {
    const open = accounts.filter(a => !a.closedAt);
    const assets = open.filter(a => a.type !== 'credit').reduce((s, a) => s + a.balance, 0);
    const liabilities = open.filter(a => a.type === 'credit').reduce((s, a) => s + Math.abs(a.balance), 0);
    return { assets, liabilities };
  }, [accounts]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Accounts</h3>
        <Link to="/accounts" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
      </div>

      <div className="space-y-4">
        {grouped.map(g => (
          <div key={g.type}>
            <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1.5">{g.label}</p>
            <div className="space-y-1">
              {g.accounts.map(a => (
                <Link
                  key={a.id}
                  to={`/accounts/${a.id}`}
                  className="flex items-center justify-between py-1 px-1 -mx-1 rounded hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-700">{a.name}</span>
                  <span className={`text-sm font-medium tabular-nums ${a.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(a.balance)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Assets</span>
          <span className="font-medium tabular-nums text-gray-900">{formatCurrency(totals.assets)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Liabilities</span>
          <span className="font-medium tabular-nums text-red-600">{formatCurrency(-totals.liabilities)}</span>
        </div>
      </div>
    </div>
  );
}
