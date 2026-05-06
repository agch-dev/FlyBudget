import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Pencil, Trash2, Lock, ChevronRight, ChevronDown, ArrowLeftRight } from 'lucide-react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface Props {
  tx: Transaction;
  categoryName: string;
  categoryMap: Map<string, string>;
  accountName?: string;
  showAccountCol?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleCleared: (id: string, cleared: number) => void;
}

export function TransactionRow({ tx, categoryName, categoryMap, accountName, showAccountCol, onEdit, onDelete, onToggleCleared }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTransfer = !!tx.transferTransactionId;
  const isSplitParent = tx.isParent === 1 && tx.children && tx.children.length > 0;

  return (
    <>
      <tr
        className="border-b border-gray-50 hover:bg-gray-50 group cursor-pointer"
        onClick={() => !tx.reconciled && onEdit(tx.id)}
      >
        {showAccountCol && (
          <td className="px-3 py-2 text-xs text-gray-500">{accountName ?? '—'}</td>
        )}
        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
          {format(parseISO(tx.date), 'MMM d')}
        </td>
        <td className="px-3 py-2 text-sm text-gray-900">
          <span className="flex items-center gap-1">
            {isTransfer && <ArrowLeftRight size={12} className="text-blue-400 shrink-0" />}
            {tx.payeeName ?? <span className="text-gray-300 italic">—</span>}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-gray-500">
          {isSplitParent ? (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="text-xs">Split ({tx.children!.length})</span>
            </button>
          ) : isTransfer ? (
            <span className="text-blue-500 text-xs">Transfer</span>
          ) : (
            categoryName || <span className="text-gray-300">—</span>
          )}
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
            onClick={() => !tx.reconciled && onToggleCleared(tx.id, tx.cleared)}
            disabled={!!tx.reconciled}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
              tx.cleared
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 text-transparent hover:border-gray-400'
            } ${tx.reconciled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Check size={10} />
          </button>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          {tx.reconciled ? (
            <div className="flex items-center justify-center w-full">
              <Lock size={12} className="text-gray-300" />
            </div>
          ) : (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(tx.id)} className="p-1 rounded text-gray-400 hover:text-blue-600">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(tx.id)} className="p-1 rounded text-gray-400 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </td>
      </tr>
      {isSplitParent && expanded && tx.children!.map((child) => (
        <tr key={child.id} className="bg-gray-50/50 border-b border-gray-50">
          {showAccountCol && <td />}
          <td />
          <td />
          <td className="px-3 py-1.5 text-xs text-gray-500 pl-8">
            {child.categoryId ? categoryMap.get(child.categoryId) ?? '—' : '—'}
          </td>
          <td className="px-3 py-1.5 text-xs text-gray-400">{child.notes ?? ''}</td>
          <td className="px-3 py-1.5 text-xs text-right tabular-nums text-gray-600">
            {child.amount < 0 ? formatCurrency(-child.amount) : ''}
          </td>
          <td className="px-3 py-1.5 text-xs text-right tabular-nums text-green-500">
            {child.amount > 0 ? formatCurrency(child.amount) : ''}
          </td>
          <td />
          <td />
        </tr>
      ))}
    </>
  );
}
