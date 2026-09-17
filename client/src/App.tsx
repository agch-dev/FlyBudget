import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import DashboardPage from './pages/Dashboard';
import AccountsPage from './pages/Accounts';
import AccountTransactionsPage from './pages/AccountTransactions';
import BudgetPage from './pages/Budget';
import TransactionsPage from './pages/Transactions';
import ReportsPage from './pages/Reports';
import CustomReportBuilder from './pages/CustomReportBuilder';
import PayeesPage from './pages/Payees';
import RulesPage from './pages/Rules';
import ReconcilePage from './pages/ReconcilePage';
import RecurringTransactionsPage from './pages/RecurringTransactions';
import SettingsPage from './pages/Settings';
import GoalsPage from './pages/Goals';

// electron loads via file:// so we need hash routing there
const isElectron = Boolean((window as any).__API_BASE__);
const Router = isElectron ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-page overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id/reconcile" element={<ReconcilePage />} />
            <Route path="/accounts/:id" element={<AccountTransactionsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/recurring" element={<RecurringTransactionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/custom" element={<CustomReportBuilder />} />
            <Route path="/reports/custom/:id" element={<CustomReportBuilder />} />
            <Route path="/payees" element={<PayeesPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
