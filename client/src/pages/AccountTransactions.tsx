import { useParams, useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/currency';
import { TransactionTable } from '../components/transactions/TransactionTable';

export default function AccountTransactionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const account = accounts.find((a) => a.id === id);

  if (!account) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-b from-white to-slate-50/50 shrink-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{account.name}</h1>
            <Badge variant={account.type} />
          </div>
          <button
            onClick={() => navigate(`/accounts/${account.id}/reconcile`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CheckSquare size={13} />
            Reconcile
          </button>
        </div>
        <p className={`text-base font-semibold tabular-nums ${account.balance < 0 ? 'text-red-500' : 'text-gray-700'}`}>
          {formatCurrency(account.balance)}
        </p>
      </div>
      <TransactionTable accountId={account.id} />
    </div>
  );
}
