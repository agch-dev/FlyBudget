import { useState } from 'react';
import { ChevronRight, ChevronDown, ArrowLeftRight, Lock } from 'lucide-react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/currency';

const PAYEE_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#06B6D4',
];

function payeeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PAYEE_COLORS[Math.abs(hash) % PAYEE_COLORS.length];
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  checking: '#3B82F6',
  savings: '#10B981',
  credit: '#F59E0B',
  cash: '#6B7280',
  investment: '#8B5CF6',
};

interface Props {
  tx: Transaction;
  categoryEntry: { name: string; icon: string | null } | null;
  categoryMap: Map<string, { name: string; icon: string | null }>;
  accountName?: string;
  accountType?: string;
  showAccountCol?: boolean;
  onEdit: (id: string) => void;
}

export function TransactionRow({ tx, categoryEntry, categoryMap, accountName, accountType, showAccountCol, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTransfer = !!tx.transferTransactionId;
  const isSplitParent = tx.isParent === 1 && tx.children && tx.children.length > 0;

  const payeeName = tx.payeeName || (isTransfer ? 'Transfer' : '—');
  const initial = payeeName.charAt(0).toUpperCase();
  const bgColor = payeeColor(payeeName);
  const acctColor = ACCOUNT_TYPE_COLORS[accountType || ''] || '#6B7280';

  return (
    <div>
      <div
        className="flex items-center px-4 py-2.5 bg-surface hover:bg-hover cursor-pointer border-b border-border-light"
        onClick={() => !tx.reconciled && onEdit(tx.id)}
      >
        <div className="flex items-center gap-3 flex-[2] min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            {isTransfer ? <ArrowLeftRight size={14} /> : initial}
          </div>
          <span className="text-sm font-medium text-text truncate">{payeeName}</span>
        </div>

        <div className="flex items-center gap-2 flex-[1.5] min-w-0">
          {isSplitParent ? (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="text-sm">Split ({tx.children!.length})</span>
            </button>
          ) : isTransfer ? (
            <span className="text-sm text-brand-500">Transfer</span>
          ) : categoryEntry ? (
            <>
              {categoryEntry.icon && <span className="text-base shrink-0">{categoryEntry.icon}</span>}
              <span className="text-sm text-text-secondary truncate">{categoryEntry.name}</span>
            </>
          ) : (
            <span className="text-sm text-text-disabled">&mdash;</span>
          )}
        </div>

        {showAccountCol && (
          <div className="flex items-center gap-2 flex-[1.5] min-w-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ backgroundColor: acctColor }}
            >
              {accountName ? accountName.charAt(0).toUpperCase() : '?'}
            </div>
            <span className="text-sm text-text-secondary truncate">{accountName || '—'}</span>
          </div>
        )}

        {tx.reconciled ? (
          <div className="w-8 flex justify-center shrink-0">
            <Lock size={12} className="text-text-disabled" />
          </div>
        ) : (
          <div className="w-8 shrink-0" />
        )}

        <div className="w-24 text-right shrink-0 mx-2">
          <span className={`text-sm font-medium tabular-nums ${tx.amount > 0 ? 'text-positive' : 'text-text'}`}>
            {formatCurrency(Math.abs(tx.amount))}
          </span>
        </div>

        <ChevronRight size={16} className="text-text-tertiary shrink-0" />
      </div>

      {isSplitParent && expanded && tx.children!.map((child) => {
        const childCat = child.categoryId ? categoryMap.get(child.categoryId) : null;
        return (
          <div key={child.id} className="flex items-center pl-16 pr-4 py-2 bg-surface-alt border-b border-border-light">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {childCat ? (
                <>
                  {childCat.icon && <span className="text-sm shrink-0">{childCat.icon}</span>}
                  <span className="text-xs text-text-tertiary truncate">{childCat.name}</span>
                </>
              ) : (
                <span className="text-xs text-text-disabled">&mdash;</span>
              )}
              {child.notes && (
                <span className="text-xs text-text-disabled truncate ml-2">{child.notes}</span>
              )}
            </div>
            <span className={`text-xs tabular-nums shrink-0 ${child.amount > 0 ? 'text-positive' : 'text-text-secondary'}`}>
              {formatCurrency(Math.abs(child.amount))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
