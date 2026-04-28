import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import AccountsPage from './pages/Accounts';
import AccountTransactionsPage from './pages/AccountTransactions';
import BudgetPage from './pages/Budget';
import TransactionsPage from './pages/Transactions';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-gray-500">Coming soon.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/budget" replace />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountTransactionsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/reports/*" element={<Placeholder title="Reports" />} />
            <Route path="/payees" element={<Placeholder title="Payees" />} />
            <Route path="/rules" element={<Placeholder title="Rules" />} />
            <Route path="/settings" element={<Placeholder title="Settings" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
