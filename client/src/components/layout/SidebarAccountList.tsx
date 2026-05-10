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
        `flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all duration-150 ${
          isActive
            ? 'bg-blue-600/20 text-blue-400 font-medium'
            : 'text-gray-400 hover:bg-white/[0.07] hover:text-gray-200'
        }`
      }
    >
      <span className="truncate">{account.name}</span>
      <span className={`ml-2 tabular-nums text-xs font-medium shrink-0 ${isNegative ? 'text-red-400' : 'text-gray-500'}`}>
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
      <div className="px-3 mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Accounts</span>
          <button
            onClick={() => setAddOpen(true)}
            className="p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/[0.07] transition-colors"
            title="Add account"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-0.5">
          {onBudget.map((a) => <AccountRow key={a.id} account={a} />)}
          {onBudget.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">No accounts yet</p>
          )}
        </div>

        {offBudget.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setOffBudgetOpen((o) => !o)}
              className="flex items-center gap-1 w-full text-xs font-semibold tracking-wider text-gray-500 uppercase hover:text-gray-300 transition-colors mb-1"
            >
              {offBudgetOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Off Budget
            </button>
            {offBudgetOpen && (
              <div className="space-y-0.5">
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
