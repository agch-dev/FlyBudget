import { format, subMonths } from 'date-fns';
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

export default function Dashboard() {
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
