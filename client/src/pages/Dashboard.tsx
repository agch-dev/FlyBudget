import { useState } from 'react';
import { format, subMonths } from 'date-fns';
import { Building2, Link2, Plus } from 'lucide-react';
import logoUrl from '/logo.png';
import { useAccounts } from '../hooks/useAccounts';
import { usePlaidStatus } from '../hooks/usePlaid';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { ConnectBankModal } from '../components/plaid/ConnectBankModal';
import { PlaidSetupModal } from '../components/plaid/PlaidSetupModal';
import { SimplefinConnectModal } from '../components/simplefin/SimplefinConnectModal';
import SummaryStats from '../components/dashboard/SummaryStats';
import AccountsOverview from '../components/dashboard/AccountsOverview';
import BudgetProgress from '../components/dashboard/BudgetProgress';
import NetWorthMini from '../components/dashboard/NetWorthMini';
import IncomeExpensesMini from '../components/dashboard/IncomeExpensesMini';
import SpendingBreakdown from '../components/dashboard/SpendingBreakdown';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import UpcomingBills from '../components/dashboard/UpcomingBills';

const now = new Date();
const currentMonth = format(now, 'yyyy-MM');
const sixMonthsAgo = format(subMonths(now, 5), 'yyyy-MM');

function WelcomeScreen() {
  const { data: plaidStatus } = usePlaidStatus();
  const plaidConfigured = plaidStatus?.configured ?? false;

  const [showPlaid, setShowPlaid] = useState(false);
  const [showPlaidSetup, setShowPlaidSetup] = useState(false);
  const [showSimplefin, setShowSimplefin] = useState(false);
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <img src={logoUrl} alt="Budget" className="w-16 h-16 mx-auto mb-6" />

        <h1 className="text-2xl font-semibold text-text">Welcome to your budget</h1>
        <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
          Get started by connecting your bank for automatic imports, or add your accounts manually.
        </p>

        <div className="grid gap-4 mt-8 grid-cols-1 sm:grid-cols-3">
          <button
            onClick={() => {
              if (plaidConfigured) setShowPlaid(true);
              else setShowPlaidSetup(true);
            }}
            className="group bg-surface border-2 border-brand-200 hover:border-brand-500 hover:shadow-hover rounded-xl p-6 text-left transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors duration-200">
              <Building2 size={20} className="text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold text-text">Connect via Plaid</h3>
            <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
              Connect your bank directly for automatic transaction import.
            </p>
          </button>

          <button
            onClick={() => setShowSimplefin(true)}
            className="group bg-surface border-2 border-brand-200 hover:border-brand-300 rounded-xl p-6 text-left transition-all duration-200 hover:shadow-hover"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
              <Link2 size={20} className="text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold text-text">Connect via SimpleFIN</h3>
            <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
              Use SimpleFIN Bridge to import transactions. $1.50/month.
            </p>
          </button>

          <button
            onClick={() => setShowManual(true)}
            className="group bg-surface border-2 border-border hover:border-text-tertiary rounded-xl p-6 text-left transition-all duration-200 hover:shadow-hover"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-alt flex items-center justify-center mb-4 group-hover:bg-hover transition-colors">
              <Plus size={20} className="text-text-secondary" />
            </div>
            <h3 className="text-sm font-semibold text-text">Add Manually</h3>
            <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
              Create accounts and enter transactions by hand.
            </p>
          </button>
        </div>

        <ConnectBankModal isOpen={showPlaid} onClose={() => setShowPlaid(false)} />
        <PlaidSetupModal isOpen={showPlaidSetup} onClose={() => setShowPlaidSetup(false)} onConfigured={() => setShowPlaid(true)} />
        <SimplefinConnectModal isOpen={showSimplefin} onClose={() => setShowSimplefin(false)} />
        <AddAccountModal isOpen={showManual} onClose={() => setShowManual(false)} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: accounts = [], isLoading } = useAccounts();

  if (!isLoading && accounts.length === 0) {
    return <WelcomeScreen />;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <NetWorthMini sixMonthsAgo={sixMonthsAgo} currentMonth={currentMonth} />

      <div className="mt-5">
        <SummaryStats currentMonth={currentMonth} sixMonthsAgo={sixMonthsAgo} />
      </div>

      <div className="mt-5">
        <IncomeExpensesMini sixMonthsAgo={sixMonthsAgo} currentMonth={currentMonth} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-5">
        <div className="lg:col-span-3">
          <BudgetProgress currentMonth={currentMonth} />
        </div>
        <div className="lg:col-span-2">
          <UpcomingBills />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <SpendingBreakdown currentMonth={currentMonth} />
        <RecentTransactions />
      </div>

      <div className="mt-5">
        <AccountsOverview />
      </div>
    </div>
  );
}
