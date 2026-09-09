import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import { AddAccountModal } from '../accounts/AddAccountModal';
import type { Account } from '../../types';

function AccountRow({ account }: { account: Account }) {
  const isNegative = account.balance < 0;
  return (
    <NavLink
      to={`/accounts/${account.id}`}
      className={({ isActive }) =>
        `flex items-center justify-between px-3 py-1 rounded-md text-[13px] transition-all duration-150 ${
          isActive
            ? 'bg-sidebar-active text-sidebar-text-hi font-medium'
            : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-hi'
        }`
      }
    >
      <span className="truncate">{account.name}</span>
      <span className={`ml-2 tabular-nums text-xs shrink-0 ${isNegative ? 'text-negative' : 'text-sidebar-text'}`}>
        {formatCurrency(account.balance)}
      </span>
    </NavLink>
  );
}

export function SidebarAccountList() {
  const { data: accounts = [] } = useAccounts();
  const [offBudgetOpen, setOffBudgetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const onBudget = accounts.filter((a) => a.isOffBudget === 0);
  const offBudget = accounts.filter((a) => a.isOffBudget === 1);

  return (
    <>
      <div className="px-3 mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold tracking-wider text-sidebar-text uppercase">Accounts</span>
          <button
            onClick={() => setAddOpen(true)}
            className="p-0.5 rounded text-sidebar-text hover:text-sidebar-text-hi hover:bg-sidebar-hover transition-colors"
            title="Add account"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="space-y-px">
          {onBudget.map((a) => <AccountRow key={a.id} account={a} />)}
          {onBudget.length === 0 && (
            <p className="px-3 py-2 text-xs text-sidebar-text">No accounts yet</p>
          )}
        </div>

        {offBudget.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setOffBudgetOpen((o) => !o)}
              className="flex items-center gap-1 w-full text-[11px] font-semibold tracking-wider text-sidebar-text uppercase hover:text-sidebar-text-hi transition-colors mb-1"
            >
              {offBudgetOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Off Budget
            </button>
            {offBudgetOpen && (
              <div className="space-y-px">
                {offBudget.map((a) => <AccountRow key={a.id} account={a} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
