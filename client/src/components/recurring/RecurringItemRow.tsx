import { Check, Pencil, X } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import type { RecurringOccurrence, OccurrenceStatus } from '../../types';

const STATUS_DOT: Record<OccurrenceStatus, string> = {
  paid: 'bg-emerald-500',
  paid_different: 'bg-amber-400',
  upcoming: 'bg-blue-400',
  overdue: 'bg-red-500',
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
    <div className={`flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition-all group ${
      occ.status === 'overdue' ? 'border-l-2 border-l-red-400' : ''
    }`}>
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[occ.status]}`} title={STATUS_LABEL[occ.status]} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isPaid ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {occ.title}
          </span>
          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {FREQ_LABEL[occ.frequency] || occ.frequency}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-400">{format(parseISO(occ.expectedDate), 'MMM d, yyyy')}</span>
          {!isPaid && daysUntil >= 0 && (
            <span className="text-xs text-gray-400">
              · {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
            </span>
          )}
          {occ.status === 'overdue' && (
            <span className="text-xs text-red-500 font-medium">
              · {Math.abs(daysUntil)} {Math.abs(daysUntil) === 1 ? 'day' : 'days'} overdue
            </span>
          )}
          {categoryName && <span className="text-xs text-gray-400">· {categoryName}</span>}
          {accountName && <span className="text-xs text-gray-400">· {accountName}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
          occ.expectedAmount > 0 ? 'text-emerald-600' : 'text-gray-800'
        } ${isPaid ? 'text-gray-400' : ''}`}>
          {occ.isApproximate ? '~' : ''}{formatCurrency(occ.expectedAmount)}
        </span>

        {occ.status === 'paid_different' && occ.linkedAmount !== null && (
          <span className="text-xs text-amber-600 tabular-nums">
            ({formatCurrency(occ.linkedAmount)})
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isPaid && onMarkPaid && (
            <button
              onClick={onMarkPaid}
              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
              title="Mark as paid"
            >
              <Check size={14} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
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
