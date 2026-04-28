import { useParams } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/currency';

export default function AccountTransactionsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: accounts = [] } = useAccounts();
  const account = accounts.find((a) => a.id === id);

  if (!account) return null;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
            <Badge variant={account.type} />
          </div>
          <p className={`text-lg font-semibold tabular-nums ${account.balance < 0 ? 'text-red-500' : 'text-gray-700'}`}>
            {formatCurrency(account.balance)}
          </p>
        </div>
      </div>
      <p className="text-gray-500">Transactions coming in Phase 4.</p>
    </div>
  );
}
