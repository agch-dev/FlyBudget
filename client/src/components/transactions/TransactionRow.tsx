import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Pencil, Trash2, Lock, ChevronRight, ChevronDown, ArrowLeftRight } from 'lucide-react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface Props {
  tx: Transaction;
  categoryEntry: { name: string; icon: string | null } | null;
  categoryMap: Map<string, { name: string; icon: string | null }>;
  accountName?: string;
  showAccountCol?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleCleared: (id: string, cleared: number) => void;
}

export function TransactionRow({ tx, categoryEntry, categoryMap, accountName, showAccountCol, onEdit, onDelete, onToggleCleared }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTransfer = !!tx.transferTransactionId;
  const isSplitParent = tx.isParent === 1 && tx.children && tx.children.length > 0;

  return (
    <>
      <tr
        className="border-b border-border-light hover:bg-hover group cursor-pointer"
        onClick={() => !tx.reconciled && onEdit(tx.id)}
      >
        {showAccountCol && (
          <td className="px-3 py-1.5 text-xs text-text-tertiary">{accountName ?? '—'}</td>
        )}
        <td className="px-3 py-1.5 text-xs text-text-tertiary whitespace-nowrap">
          {format(parseISO(tx.date), 'MMM d')}
        </td>
        <td className="px-3 py-1.5 text-sm font-medium text-text">
          <span className="flex items-center gap-1">
            {isTransfer && <ArrowLeftRight size={12} className="text-brand-500 shrink-0" />}
            {tx.payeeName ?? <span className="text-text-disabled italic">—</span>}
          </span>
        </td>
        <td className="px-3 py-1.5 text-sm text-text-tertiary">
          {isSplitParent ? (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="text-xs">Split ({tx.children!.length})</span>
            </button>
          ) : isTransfer ? (
            <span className="text-brand-500 text-xs">Transfer</span>
          ) : categoryEntry ? (
            <span>{categoryEntry.icon ? `${categoryEntry.icon} ` : ''}{categoryEntry.name}</span>
          ) : (
            <span className="text-text-disabled">—</span>
          )}
        </td>
        <td className="px-3 py-1.5 text-sm text-text-tertiary">{tx.notes ?? ''}</td>
        <td className="px-3 py-1.5 text-sm text-right tabular-nums text-text">
          {tx.amount < 0 ? formatCurrency(-tx.amount) : ''}
        </td>
        <td className="px-3 py-1.5 text-sm text-right tabular-nums text-positive">
          {tx.amount > 0 ? formatCurrency(tx.amount) : ''}
        </td>
        <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => !tx.reconciled && onToggleCleared(tx.id, tx.cleared)}
            disabled={!!tx.reconciled}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
              tx.cleared
                ? 'bg-positive border-positive text-white'
                : 'border-border text-transparent hover:border-text-tertiary'
            } ${tx.reconciled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Check size={10} />
          </button>
        </td>
        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
          {tx.reconciled ? (
            <div className="flex items-center justify-center w-full">
              <Lock size={12} className="text-text-disabled" />
            </div>
          ) : (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(tx.id)} className="p-1 rounded text-text-tertiary hover:text-brand-600">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(tx.id)} className="p-1 rounded text-text-tertiary hover:text-negative">
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </td>
      </tr>
      {isSplitParent && expanded && tx.children!.map((child) => (
        <tr key={child.id} className="bg-surface-alt border-b border-border-light">
          {showAccountCol && <td />}
          <td />
          <td />
          <td className="px-3 py-1.5 text-xs text-text-tertiary pl-8">
            {child.categoryId ? (() => { const e = categoryMap.get(child.categoryId!); return e ? `${e.icon ? e.icon + ' ' : ''}${e.name}` : '—'; })() : '—'}
          </td>
          <td className="px-3 py-1.5 text-xs text-text-tertiary">{child.notes ?? ''}</td>
          <td className="px-3 py-1.5 text-xs text-right tabular-nums text-text-secondary">
            {child.amount < 0 ? formatCurrency(-child.amount) : ''}
          </td>
          <td className="px-3 py-1.5 text-xs text-right tabular-nums text-positive">
            {child.amount > 0 ? formatCurrency(child.amount) : ''}
          </td>
          <td />
          <td />
        </tr>
      ))}
    </>
  );
}
