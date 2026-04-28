import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction, useToggleClearedTransaction } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useAccounts } from '../../hooks/useAccounts';
import { TransactionFilters, DEFAULT_FILTERS, filtersToParams } from './TransactionFilters';
import { TransactionFormRow } from './TransactionFormRow';
import { TransactionRow } from './TransactionRow';
import type { FilterState } from './TransactionFilters';
import type { CategoryGroup } from '../../types';
import type { CreateTransactionData } from '../../api/transactions';

interface Props {
  accountId?: string;
}

export function TransactionTable({ accountId }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const showAccountCol = !accountId;
  const colCount = showAccountCol ? 9 : 8;

  const params = useMemo(() => filtersToParams(filters, accountId), [filters, accountId]);
  const { data: transactions = [], isLoading } = useTransactions(params);
  const { data: groups = [] } = useCategories();
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();

  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();
  const toggleCleared = useToggleClearedTransaction();

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups as CategoryGroup[]) {
      for (const c of g.categories) map.set(c.id, c.name);
    }
    return map;
  }, [groups]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  function handleCreate(data: CreateTransactionData) {
    createTx.mutate(data, { onSuccess: () => setShowAdd(false) });
  }

  function handleUpdate(id: string, data: CreateTransactionData) {
    updateTx.mutate({ id, data }, { onSuccess: () => setEditingId(null) });
  }

  function handleToggleCleared(id: string, cleared: number) {
    toggleCleared.mutate({ id, cleared: cleared ? 0 : 1 });
  }

  return (
    <div className="flex flex-col h-full">
      <TransactionFilters state={filters} onChange={setFilters} />
      <div className="px-4 py-2 border-b border-gray-100 bg-white flex justify-between items-center">
        <span className="text-xs text-gray-400">{transactions.length} transactions</span>
        {accountId && (
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={13} /> Add Transaction
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-100">
              {showAccountCol && <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Account</th>}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide w-24">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Payee</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-28">Outflow</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-28">Inflow</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-10">C</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {showAdd && accountId && (
              <TransactionFormRow
                accountId={accountId}
                groups={groups as CategoryGroup[]}
                payees={payees}
                onSave={handleCreate}
                onCancel={() => setShowAdd(false)}
              />
            )}
            {isLoading ? (
              <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : transactions.length === 0 && !showAdd ? (
              <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-gray-400">No transactions found.</td></tr>
            ) : transactions.map((tx) =>
              editingId === tx.id ? (
                <TransactionFormRow
                  key={tx.id}
                  initial={tx}
                  accountId={tx.accountId}
                  groups={groups as CategoryGroup[]}
                  payees={payees}
                  onSave={(data) => handleUpdate(tx.id, data)}
                  onCancel={() => setEditingId(null)}
                  showAccountCol={showAccountCol}
                />
              ) : (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  categoryName={tx.categoryId ? (categoryMap.get(tx.categoryId) ?? '') : ''}
                  accountName={showAccountCol ? accountMap.get(tx.accountId) : undefined}
                  showAccountCol={showAccountCol}
                  onEdit={setEditingId}
                  onDelete={(id) => deleteTx.mutate(id)}
                  onToggleCleared={handleToggleCleared}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
