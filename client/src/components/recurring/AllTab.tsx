import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useUpdateRecurring, useDeleteRecurring } from '../../hooks/useRecurringTransactions';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { RecurringTransaction } from '../../types';

const FREQ_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  semimonthly: '2x/month',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannually: '6 months',
  yearly: 'Yearly',
};

interface Props {
  allRecurring: RecurringTransaction[];
  onEdit: (item: RecurringTransaction) => void;
}

export default function AllTab({ allRecurring, onEdit }: Props) {
  const [canceledOpen, setCanceledOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useCategories();
  const updateRecurring = useUpdateRecurring();
  const deleteRecurring = useDeleteRecurring();

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) for (const c of g.categories) map.set(c.id, c.name);
    return map;
  }, [groups]);

  const active = allRecurring.filter((r) => r.status === 'active' || r.status === 'paused');
  const canceled = allRecurring.filter((r) => r.status === 'canceled');

  function Row({ item }: { item: RecurringTransaction }) {
    const isPaused = item.status === 'paused';
    return (
      <div className={`flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition-all group ${
        isPaused ? 'opacity-60' : ''
      }`}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isPaused ? 'bg-gray-300' : item.amount > 0 ? 'bg-emerald-500' : 'bg-blue-400'
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {FREQ_LABEL[item.frequency] || item.frequency}
            </span>
            {isPaused && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Paused</span>
            )}
            {Boolean(item.autoCreate) && (
              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Auto</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {item.categoryId && categoryMap.has(item.categoryId) && (
              <span className="text-xs text-gray-400">{categoryMap.get(item.categoryId)}</span>
            )}
            {item.accountId && accountMap.has(item.accountId) && (
              <span className="text-xs text-gray-400">· {accountMap.get(item.accountId)}</span>
            )}
            <span className="text-xs text-gray-400">· Since {item.startDate}</span>
          </div>
        </div>

        <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
          item.amount > 0 ? 'text-emerald-600' : 'text-gray-800'
        }`}>
          {Boolean(item.isApproximate) && '~'}{formatCurrency(item.amount)}
        </span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => updateRecurring.mutate({
              id: item.id,
              status: isPaused ? 'active' : 'paused',
            })}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setDeleteId(item.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Cancel"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="space-y-2 mb-6">
        {active.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            No active recurring items yet. Add one to get started.
          </div>
        ) : (
          active.map((item) => <Row key={item.id} item={item} />)
        )}
      </div>

      {canceled.length > 0 && (
        <div>
          <button
            onClick={() => setCanceledOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-500 mb-2"
          >
            {canceledOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Canceled ({canceled.length})
          </button>
          {canceledOpen && (
            <div className="space-y-2 opacity-50">
              {canceled.map((item) => <Row key={item.id} item={item} />)}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteRecurring.mutate({ id: deleteId });
          setDeleteId(null);
        }}
        title="Cancel Recurring Item?"
        message="This will mark the item as canceled. It can be found under the Canceled section."
        confirmLabel="Cancel Item"
        danger
      />
    </div>
  );
}
