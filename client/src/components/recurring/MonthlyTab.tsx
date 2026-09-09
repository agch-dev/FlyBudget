import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import Calendar from './Calendar';
import RecurringItemRow from './RecurringItemRow';
import RecurringSummaryBar from './RecurringSummaryBar';
import { useOccurrences, useRecurringSummary, useMarkAsPaid } from '../../hooks/useRecurringTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import type { RecurringTransaction } from '../../types';

interface Props {
  onEdit: (item: RecurringTransaction) => void;
  allRecurring: RecurringTransaction[];
}

export default function MonthlyTab({ onEdit, allRecurring }: Props) {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  const from = format(startOfMonth(new Date(`${month}-01`)), 'yyyy-MM-dd');
  const to = format(endOfMonth(new Date(`${month}-01`)), 'yyyy-MM-dd');

  const { data: occurrences = [], isLoading } = useOccurrences(from, to);
  const { data: summary, isLoading: summaryLoading } = useRecurringSummary(month);
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <RecurringSummaryBar summary={summary} isLoading={summaryLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="bg-surface rounded-lg shadow-card border border-border-light p-4">
          <Calendar month={month} onMonthChange={setMonth} occurrences={occurrences} />
        </div>

        <div>
          {isLoading ? (
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-surface-alt rounded animate-pulse" />
              ))}
            </div>
          ) : occurrences.length === 0 ? (
            <div className="text-center py-12 text-sm text-text-tertiary">
              No recurring items for this month.
            </div>
          ) : (
            <div className="bg-surface rounded-lg shadow-card border border-border-light overflow-hidden">
              {occurrences.map((occ, i) => (
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
      </div>
    </div>
  );
}
