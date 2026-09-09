import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import RecurringItemRow from './RecurringItemRow';
import { useOccurrences, useMarkAsPaid } from '../../hooks/useRecurringTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import type { RecurringTransaction } from '../../types';

interface Props {
  onEdit: (item: RecurringTransaction) => void;
  allRecurring: RecurringTransaction[];
}

export default function UpcomingTab({ onEdit, allRecurring }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const sixtyDaysOut = format(addDays(new Date(), 60), 'yyyy-MM-dd');

  const { data: occurrences = [], isLoading } = useOccurrences(today, sixtyDaysOut);
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useCategories();
  const markPaid = useMarkAsPaid();

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) for (const c of g.categories) map.set(c.id, c.name);
    return map;
  }, [groups]);

  const recMap = useMemo(() => new Map(allRecurring.map((r) => [r.id, r])), [allRecurring]);

  const unpaid = occurrences.filter((o) => o.status === 'upcoming' || o.status === 'overdue');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <p className="text-xs text-text-tertiary mb-4">Showing unpaid items for the next 60 days</p>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      ) : unpaid.length === 0 ? (
        <div className="text-center py-16 text-sm text-text-tertiary">
          All caught up — no upcoming items.
        </div>
      ) : (
        <div className="bg-surface rounded-lg shadow-card border border-border-light overflow-hidden">
          {unpaid.map((occ, i) => (
            <RecurringItemRow
              key={`${occ.recurringTransactionId}-${occ.expectedDate}-${i}`}
              occurrence={occ}
              accountName={occ.accountId ? accountMap.get(occ.accountId) : undefined}
              categoryName={occ.categoryId ? categoryMap.get(occ.categoryId) : undefined}
              onMarkPaid={() => markPaid.mutate({ id: occ.recurringTransactionId, date: occ.expectedDate })}
              onEdit={() => {
                const rec = recMap.get(occ.recurringTransactionId);
                if (rec) onEdit(rec);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
