import { useState, useMemo } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useTransactions, useCreateTransaction, useCreateTransfer, useUpdateTransaction, useDeleteTransaction, useToggleCleared } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useAccounts } from '../../hooks/useAccounts';
import { TransactionFilters, DEFAULT_FILTERS, filtersToParams } from './TransactionFilters';
import { TransactionFormRow } from './TransactionFormRow';
import { TransactionRow } from './TransactionRow';
import { ImportModal } from './ImportModal';
import { Button } from '../ui/Button';
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
  const [showImport, setShowImport] = useState(false);

  const showAccountCol = !accountId;
  const colCount = showAccountCol ? 9 : 8;

  const params = useMemo(() => filtersToParams(filters, accountId), [filters, accountId]);
  const { data: transactions = [], isLoading } = useTransactions(params);
  const { data: groups = [] } = useCategories();
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();

  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();
  const toggleCleared = useToggleCleared();

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups as CategoryGroup[]) {
      for (const c of g.categories) map.set(c.id, c.name);
    }
    return map;
  }, [groups]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  function handleCreate(data: CreateTransactionData) {
    if (data.categoryId?.startsWith('transfer:') && accountId) {
      const toAccountId = data.categoryId.slice('transfer:'.length);
      createTransfer.mutate({
        fromAccountId: accountId,
        toAccountId,
        date: data.date,
        amount: Math.abs(data.amount),
        notes: data.notes,
        cleared: data.cleared,
      }, { onSuccess: () => setShowAdd(false) });
      return;
    }
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
      <div className="px-4 py-2 border-b border-border-light bg-surface flex justify-between items-center">
        <span className="text-xs text-text-tertiary">{transactions.length} transactions</span>
        {accountId && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              <Upload size={13} /> Import CSV
            </Button>
            <Button size="sm" onClick={() => { setShowAdd(true); setEditingId(null); }}>
              <Plus size={13} /> Add Transaction
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface-alt z-10">
            <tr className="border-b border-border">
              {showAccountCol && <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Account</th>}
              <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary w-24">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Payee</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Notes</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary w-28">Outflow</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary w-28">Inflow</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-text-tertiary w-10">C</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {showAdd && accountId && (
              <TransactionFormRow
                accountId={accountId}
                groups={groups as CategoryGroup[]}
                payees={payees}
                accounts={accounts}
                onSave={handleCreate}
                onCancel={() => setShowAdd(false)}
              />
            )}
            {isLoading ? (
              <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-text-tertiary">Loading...</td></tr>
            ) : transactions.length === 0 && !showAdd ? (
              <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-text-tertiary">No transactions found.</td></tr>
            ) : transactions.map((tx) =>
              editingId === tx.id ? (
                <TransactionFormRow
                  key={tx.id}
                  initial={tx}
                  accountId={tx.accountId}
                  groups={groups as CategoryGroup[]}
                  payees={payees}
                  accounts={accounts}
                  onSave={(data) => handleUpdate(tx.id, data)}
                  onCancel={() => setEditingId(null)}
                  showAccountCol={showAccountCol}
                />
              ) : (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  categoryName={tx.categoryId ? (categoryMap.get(tx.categoryId) ?? '') : ''}
                  categoryMap={categoryMap}
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
      {accountId && (
        <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} accountId={accountId} />
      )}
    </div>
  );
}
