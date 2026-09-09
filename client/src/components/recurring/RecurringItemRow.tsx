import { Check, Pencil } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import type { RecurringOccurrence, OccurrenceStatus } from '../../types';

const STATUS_DOT: Record<OccurrenceStatus, string> = {
  paid: 'bg-positive',
  paid_different: 'bg-caution',
  upcoming: 'bg-brand-500',
  overdue: 'bg-negative',
};

const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  paid: 'Paid',
  paid_different: 'Paid (different amount)',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
};

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
  occurrence: RecurringOccurrence;
  accountName?: string;
  categoryName?: string;
  onMarkPaid?: () => void;
  onEdit?: () => void;
}

export default function RecurringItemRow({ occurrence: occ, accountName, categoryName, onMarkPaid, onEdit }: Props) {
  const daysUntil = differenceInDays(parseISO(occ.expectedDate), new Date());
  const isPaid = occ.status === 'paid' || occ.status === 'paid_different';

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border-light hover:bg-hover transition-colors group ${
      occ.status === 'overdue' ? 'border-l-2 border-l-negative' : ''
    }`}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[occ.status]}`} title={STATUS_LABEL[occ.status]} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isPaid ? 'text-text-disabled line-through' : 'text-text'}`}>
            {occ.title}
          </span>
          <span className="text-[10px] font-medium text-text-tertiary bg-surface-alt px-1.5 py-0.5 rounded">
            {FREQ_LABEL[occ.frequency] || occ.frequency}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-text-tertiary">{format(parseISO(occ.expectedDate), 'MMM d, yyyy')}</span>
          {!isPaid && daysUntil >= 0 && (
            <span className="text-xs text-text-tertiary">
              · {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
            </span>
          )}
          {occ.status === 'overdue' && (
            <span className="text-xs text-negative font-medium">
              · {Math.abs(daysUntil)} {Math.abs(daysUntil) === 1 ? 'day' : 'days'} overdue
            </span>
          )}
          {categoryName && <span className="text-xs text-text-tertiary">· {categoryName}</span>}
          {accountName && <span className="text-xs text-text-tertiary">· {accountName}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${
          isPaid ? 'text-text-disabled' : occ.expectedAmount > 0 ? 'text-positive' : 'text-text'
        }`}>
          {occ.isApproximate ? '~' : ''}{formatCurrency(occ.expectedAmount)}
        </span>

        {occ.status === 'paid_different' && occ.linkedAmount !== null && (
          <span className="text-xs text-caution tabular-nums">
            ({formatCurrency(occ.linkedAmount)})
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isPaid && onMarkPaid && (
            <button
              onClick={onMarkPaid}
              className="p-1 rounded text-positive hover:bg-positive-subtle transition-colors"
              title="Mark as paid"
            >
              <Check size={14} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-hover transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
