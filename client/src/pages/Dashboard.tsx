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
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-sm text-gray-500 font-medium">{format(now, 'MMMM yyyy')}</span>
      </div>

      <div className="space-y-5">
        <SummaryStats currentMonth={currentMonth} sixMonthsAgo={sixMonthsAgo} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AccountsOverview />
          <BudgetProgress currentMonth={currentMonth} />
          <NetWorthMini sixMonthsAgo={sixMonthsAgo} currentMonth={currentMonth} />
          <IncomeExpensesMini sixMonthsAgo={sixMonthsAgo} currentMonth={currentMonth} />
          <SpendingBreakdown currentMonth={currentMonth} />
          <UpcomingBills />
          <RecentTransactions />
        </div>
      </div>
    </div>
  );
}
