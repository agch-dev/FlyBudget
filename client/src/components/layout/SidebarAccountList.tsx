import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight, Building2, Link2 } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { usePlaidStatus } from '../../hooks/usePlaid';
import { formatCurrency } from '../../utils/currency';
import { AddAccountModal } from '../accounts/AddAccountModal';
import { ConnectBankModal } from '../plaid/ConnectBankModal';
import { PlaidSetupModal } from '../plaid/PlaidSetupModal';
import { SimplefinConnectModal } from '../simplefin/SimplefinConnectModal';
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
  const { data: plaidStatus } = usePlaidStatus();
  const plaidConfigured = plaidStatus?.configured ?? false;

  const [offBudgetOpen, setOffBudgetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [plaidSetupOpen, setPlaidSetupOpen] = useState(false);
  const [simplefinOpen, setSimplefinOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const onBudget = accounts.filter((a) => a.isOffBudget === 0);
  const offBudget = accounts.filter((a) => a.isOffBudget === 1);

  return (
    <>
      {/* Header — outside scroll container so dropdown isn't clipped */}
      <div className="shrink-0 px-3 mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold tracking-wider text-sidebar-text uppercase">Accounts</span>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-0.5 rounded text-sidebar-text hover:text-sidebar-text-hi hover:bg-sidebar-hover transition-colors"
              title="Add account"
            >
              <Plus size={13} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface rounded-md border border-border shadow-hover z-30 py-1">
                <button
                  onClick={() => { setMenuOpen(false); setAddOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text transition-colors"
                >
                  <Plus size={14} className="shrink-0" />
                  Add Manual Account
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (plaidConfigured) setConnectOpen(true);
                    else setPlaidSetupOpen(true);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text transition-colors"
                >
                  <Building2 size={14} className="shrink-0" />
                  Connect via Plaid
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setSimplefinOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text transition-colors"
                >
                  <Link2 size={14} className="shrink-0" />
                  Connect via SimpleFIN
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable account list */}
      <div className="flex-1 overflow-y-auto px-3">
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
      <ConnectBankModal isOpen={connectOpen} onClose={() => setConnectOpen(false)} />
      <PlaidSetupModal isOpen={plaidSetupOpen} onClose={() => setPlaidSetupOpen(false)} onConfigured={() => setConnectOpen(true)} />
      <SimplefinConnectModal isOpen={simplefinOpen} onClose={() => setSimplefinOpen(false)} />
    </>
  );
}
