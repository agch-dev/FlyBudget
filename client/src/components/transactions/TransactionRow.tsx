import { format, parseISO } from 'date-fns';
import { Check, Pencil, Trash2 } from 'lucide-react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface Props {
  tx: Transaction;
  categoryName: string;
  accountName?: string;
  showAccountCol?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleCleared: (id: string, cleared: number) => void;
}

export function TransactionRow({ tx, categoryName, accountName, showAccountCol, onEdit, onDelete, onToggleCleared }: Props) {
  return (
    <tr
      className="border-b border-gray-50 hover:bg-gray-50 group cursor-pointer"
      onClick={() => onEdit(tx.id)}
    >
      {showAccountCol && (
        <td className="px-3 py-2 text-xs text-gray-500">{accountName ?? '—'}</td>
      )}
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
        {format(parseISO(tx.date), 'MMM d')}
      </td>
      <td className="px-3 py-2 text-sm text-gray-900">
        {tx.payeeName ?? <span className="text-gray-300 italic">—</span>}
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">
        {categoryName || <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2 text-sm text-gray-400">{tx.notes ?? ''}</td>
      <td className="px-3 py-2 text-sm text-right tabular-nums text-gray-900">
        {tx.amount < 0 ? formatCurrency(-tx.amount) : ''}
      </td>
      <td className="px-3 py-2 text-sm text-right tabular-nums text-green-600">
        {tx.amount > 0 ? formatCurrency(tx.amount) : ''}
      </td>
      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onToggleCleared(tx.id, tx.cleared)}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
            tx.cleared
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 text-transparent hover:border-gray-400'
          }`}
        >
          <Check size={10} />
        </button>
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(tx.id)} className="p-1 rounded text-gray-400 hover:text-blue-600">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(tx.id)} className="p-1 rounded text-gray-400 hover:text-red-600">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
