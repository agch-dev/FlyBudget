import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { EditAccountModal } from '../components/accounts/EditAccountModal';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/currency';
import type { Account } from '../types';

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
}

function AccountCard({ account, onEdit }: AccountCardProps) {
  const navigate = useNavigate();
  const isNegative = account.balance < 0;
  return (
    <div
      onClick={() => navigate(`/accounts/${account.id}`)}
      className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <Badge variant={account.type} />
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(account); }}
          className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-gray-600 transition-opacity"
        >
          Edit
        </button>
      </div>
      <p className="text-sm font-medium text-gray-900 truncate">{account.name}</p>
      <p className={`text-xl font-semibold mt-1 tabular-nums ${isNegative ? 'text-red-500' : 'text-gray-900'}`}>
        {formatCurrency(account.balance)}
      </p>
    </div>
  );
}

export default function AccountsPage() {
  const { data: accounts = [], isLoading } = useAccounts();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const onBudget = accounts.filter((a) => a.isOffBudget === 0);
  const offBudget = accounts.filter((a) => a.isOffBudget === 1);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl shadow-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Accounts</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-150"
        >
          <Plus size={16} />
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">No accounts yet. Add one to get started.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Account
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {onBudget.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">On Budget</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {onBudget.map((a) => <AccountCard key={a.id} account={a} onEdit={setEditing} />)}
              </div>
            </section>
          )}
          {offBudget.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">Off Budget</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {offBudget.map((a) => <AccountCard key={a.id} account={a} onEdit={setEditing} />)}
              </div>
            </section>
          )}
        </div>
      )}

      <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <EditAccountModal account={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
