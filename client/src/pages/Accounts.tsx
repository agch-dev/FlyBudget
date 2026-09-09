import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { EditAccountModal } from '../components/accounts/EditAccountModal';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../utils/currency';
import type { Account } from '../types';

const TYPE_ORDER = ['checking', 'savings', 'cash', 'credit', 'investment'] as const;
const TYPE_LABELS: Record<string, string> = {
  checking: 'Cash',
  savings: 'Cash',
  cash: 'Cash',
  credit: 'Credit Cards',
  investment: 'Investments',
};

function groupAccountsByType(accounts: Account[]) {
  const groups = new Map<string, Account[]>();
  for (const a of accounts) {
    const label = TYPE_LABELS[a.type] ?? a.type;
    const list = groups.get(label) ?? [];
    list.push(a);
    groups.set(label, list);
  }
  const order = ['Cash', 'Credit Cards', 'Investments'];
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, accounts: groups.get(label)! }));
}

interface AccountGroupProps {
  label: string;
  accounts: Account[];
  onEdit: (account: Account) => void;
}

function AccountGroup({ label, accounts, onEdit }: AccountGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const groupTotal = accounts.reduce((sum, a) => sum + a.balance, 0);
  const isNegativeGroup = groupTotal < 0;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-alt border-y border-border-light hover:bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-text-tertiary">
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{label}</span>
          <span className="text-xs text-text-tertiary">{accounts.length}</span>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${isNegativeGroup ? 'text-negative' : 'text-text'}`}>
          {formatCurrency(groupTotal)}
        </span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-border-light">
          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => navigate(`/accounts/${account.id}`)}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-hover cursor-pointer group transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-text truncate">{account.name}</span>
                <Badge variant={account.type} />
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(account); }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-brand-600 transition-opacity"
                >
                  Edit
                </button>
              </div>
              <span className={`text-sm font-medium tabular-nums ${account.balance < 0 ? 'text-negative' : 'text-text'}`}>
                {formatCurrency(account.balance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  const { data: accounts = [], isLoading } = useAccounts();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const onBudget = accounts.filter((a) => a.isOffBudget === 0);
  const offBudget = accounts.filter((a) => a.isOffBudget === 1);

  const onBudgetGroups = useMemo(() => groupAccountsByType(onBudget), [onBudget]);
  const offBudgetGroups = useMemo(() => groupAccountsByType(offBudget), [offBudget]);

  const totalAssets = accounts
    .filter((a) => a.type !== 'credit')
    .reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts
    .filter((a) => a.type === 'credit')
    .reduce((sum, a) => sum + a.balance, 0);
  const netWorth = totalAssets + totalLiabilities;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="h-5 w-32 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Accounts</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-tertiary mb-4">No accounts yet. Add one to get started.</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Add Account
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5">
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Net Worth</p>
            <p className={`text-2xl font-semibold tabular-nums ${netWorth < 0 ? 'text-negative' : 'text-text'}`}>
              {formatCurrency(netWorth)}
            </p>
          </div>

          {onBudgetGroups.length > 0 && (
            <div className="mb-4">
              <div className="px-4 py-1.5">
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">On Budget</span>
              </div>
              {onBudgetGroups.map((g) => (
                <AccountGroup key={g.label} label={g.label} accounts={g.accounts} onEdit={setEditing} />
              ))}
            </div>
          )}

          {offBudgetGroups.length > 0 && (
            <div className="mb-4">
              <div className="px-4 py-1.5">
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Off Budget</span>
              </div>
              {offBudgetGroups.map((g) => (
                <AccountGroup key={g.label} label={g.label} accounts={g.accounts} onEdit={setEditing} />
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border bg-surface-alt">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Assets</span>
              <span className="tabular-nums font-medium">{formatCurrency(totalAssets)}</span>
            </div>
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>Liabilities</span>
              <span className="tabular-nums font-medium text-negative">{formatCurrency(totalLiabilities)}</span>
            </div>
          </div>
        </div>
      )}

      <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <EditAccountModal account={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
