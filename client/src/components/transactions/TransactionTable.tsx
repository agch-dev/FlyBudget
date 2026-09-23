import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Upload } from 'lucide-react';
import { useTransactions, useCreateTransaction, useCreateTransfer } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useAccounts } from '../../hooks/useAccounts';
import { TransactionFilters, DEFAULT_FILTERS, filtersToParams } from './TransactionFilters';
import { TransactionFormRow } from './TransactionFormRow';
import { TransactionRow } from './TransactionRow';
import { TransactionDetailPanel } from './TransactionDetailPanel';
import { ImportModal } from './ImportModal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/currency';
import type { FilterState } from './TransactionFilters';
import type { CategoryGroup } from '../../types';
import type { CreateTransactionData } from '../../api/transactions';

interface Props {
  accountId?: string;
  categoryId?: string;
  month?: string;
}

export function TransactionTable({ accountId, categoryId, month }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const showAccountCol = !accountId;

  const params = useMemo(() => {
    const base = filtersToParams(filters, accountId);
    if (categoryId && !base.categoryId) base.categoryId = categoryId;
    if (month && !base.from && !base.to) base.month = month;
    return base;
  }, [filters, accountId, categoryId, month]);
  const { data: transactions = [], isLoading } = useTransactions(params);
  const { data: groups = [] } = useCategories();
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();

  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null }>();
    for (const g of groups as CategoryGroup[]) {
      for (const c of g.categories) map.set(c.id, { name: c.name, icon: c.icon });
    }
    return map;
  }, [groups]);

  const accountInfoMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, { name: a.name, type: a.type }])),
    [accounts],
  );

  const selectedTx = useMemo(
    () => detailId ? transactions.find(tx => tx.id === detailId) ?? null : null,
    [detailId, transactions],
  );

  const groupedByDate = useMemo(() => {
    const result: Array<{ date: string; txs: typeof transactions; total: number }> = [];
    let currentDate = '';
    let currentTxs: typeof transactions = [];

    for (const tx of transactions) {
      if (tx.date !== currentDate) {
        if (currentTxs.length > 0) {
          result.push({
            date: currentDate,
            txs: currentTxs,
            total: currentTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0),
          });
        }
        currentDate = tx.date;
        currentTxs = [tx];
      } else {
        currentTxs.push(tx);
      }
    }

    if (currentTxs.length > 0) {
      result.push({
        date: currentDate,
        txs: currentTxs,
        total: currentTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      });
    }

    return result;
  }, [transactions]);

  function handleCreate(data: CreateTransactionData) {
    if (data.categoryId?.startsWith('transfer:') && accountId) {
      const toAccountId = data.categoryId.slice('transfer:'.length);
      createTransfer.mutate({
        fromAccountId: accountId,
        toAccountId,
        date: data.date,
        amount: Math.abs(data.amount),
        notes: data.notes,
      }, { onSuccess: () => setShowAdd(false) });
      return;
    }
    createTx.mutate(data, { onSuccess: () => setShowAdd(false) });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TransactionFilters
        state={filters}
        onChange={setFilters}
        categoryName={filters.categoryId ? categoryMap.get(filters.categoryId)?.name : undefined}
      />
      <div className="px-4 py-2 border-b border-border-light bg-surface flex justify-between items-center">
        <span className="text-xs text-text-tertiary">{transactions.length} transactions</span>
        {accountId && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              <Upload size={13} /> Import CSV
            </Button>
            <Button size="sm" onClick={() => { setShowAdd(true); setDetailId(null); }}>
              <Plus size={13} /> Add Transaction
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
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
            <div className="px-4 py-10 text-center text-sm text-text-tertiary">Loading...</div>
          ) : transactions.length === 0 && !showAdd ? (
            <div className="px-4 py-10 text-center text-sm text-text-tertiary">No transactions found.</div>
          ) : (
            groupedByDate.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-between px-4 py-2 bg-surface-alt border-b border-border-light">
                  <span className="text-sm font-medium text-text-secondary">
                    {format(parseISO(group.date), 'MMMM d, yyyy')}
                  </span>
                  <span className="text-sm font-medium text-text-secondary tabular-nums">
                    {formatCurrency(group.total)}
                  </span>
                </div>

                {group.txs.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    categoryEntry={tx.categoryId ? (categoryMap.get(tx.categoryId) ?? null) : null}
                    categoryMap={categoryMap}
                    groups={groups as CategoryGroup[]}
                    payees={payees}
                    accountName={showAccountCol ? accountInfoMap.get(tx.accountId)?.name : undefined}
                    accountType={showAccountCol ? accountInfoMap.get(tx.accountId)?.type : undefined}
                    showAccountCol={showAccountCol}
                    isSelected={detailId === tx.id}
                    onOpenDetail={setDetailId}
                    onFilterCategory={(catId) => setFilters(f => ({ ...f, categoryId: catId, datePreset: 'all' }))}
                    onFilterSearch={(search) => setFilters(f => ({ ...f, search, datePreset: 'all' }))}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {selectedTx && (
          <TransactionDetailPanel
            transaction={selectedTx}
            categoryMap={categoryMap}
            groups={groups as CategoryGroup[]}
            payees={payees}
            accounts={accounts}
            accountName={accountInfoMap.get(selectedTx.accountId)?.name}
            accountType={accountInfoMap.get(selectedTx.accountId)?.type}
            onClose={() => setDetailId(null)}
          />
        )}
      </div>

      {accountId && (
        <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} accountId={accountId} />
      )}
    </div>
  );
}
