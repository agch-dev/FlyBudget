import { TransactionTable } from '../components/transactions/TransactionTable';

export default function TransactionsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-b from-white to-slate-50/50 shrink-0">
        <h1 className="text-xl font-bold text-gray-800">All Transactions</h1>
      </div>
      <TransactionTable />
    </div>
  );
}
