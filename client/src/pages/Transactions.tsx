import { TransactionTable } from '../components/transactions/TransactionTable';

export default function TransactionsPage() {
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-text">All Transactions</h1>
      </div>
      <TransactionTable />
    </div>
  );
}
