import { useParams } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/currency';
import { TransactionTable } from '../components/transactions/TransactionTable';

export default function AccountTransactionsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: accounts = [] } = useAccounts();
  const account = accounts.find((a) => a.id === id);

  if (!account) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-xl font-bold text-gray-900">{account.name}</h1>
          <Badge variant={account.type} />
        </div>
        <p className={`text-base font-semibold tabular-nums ${account.balance < 0 ? 'text-red-500' : 'text-gray-700'}`}>
          {formatCurrency(account.balance)}
        </p>
      </div>
      <TransactionTable accountId={account.id} />
    </div>
  );
}
