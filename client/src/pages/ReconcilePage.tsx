import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAccounts } from '../hooks/useAccounts';
import { useTransactions, useReconcileAccount, useCreateTransaction } from '../hooks/useTransactions';
import { Badge } from '../components/ui/Badge';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { formatCurrency } from '../utils/currency';
import type { Transaction } from '../types';

export default function ReconcilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: accounts = [] } = useAccounts();
  const account = accounts.find(a => a.id === id);

  // Fetch only unreconciled transactions for this account
  const { data: unreconciledTxns = [], isLoading } = useTransactions(
    id ? { accountId: id, reconciled: 0 } : {},
  );

  const reconcileAccount = useReconcileAccount();
  const createTransaction = useCreateTransaction();

  const [step, setStep] = useState<1 | 2>(1);
  const [statementBalance, setStatementBalance] = useState(0);
  // Pre-check already-cleared transactions
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // When step 2 loads, pre-check already-cleared transactions
  function startStep2() {
    const preChecked = new Set(unreconciledTxns.filter(t => t.cleared === 1).map(t => t.id));
    setCheckedIds(preChecked);
    setStep(2);
  }

  // reconciledBase = the portion of the balance already locked (reconciled=1 txns)
  // Since we only fetched reconciled=0 txns, we derive it as:
  // account.balance - sum(unreconciledTxns)
  const reconciledBase = useMemo(() => {
    if (!account) return 0;
    const unreconciledSum = unreconciledTxns.reduce((s, t) => s + t.amount, 0);
    return account.balance - unreconciledSum;
  }, [account, unreconciledTxns]);

  const checkedSum = useMemo(() => {
    return unreconciledTxns
      .filter(t => checkedIds.has(t.id))
      .reduce((s, t) => s + t.amount, 0);
  }, [unreconciledTxns, checkedIds]);

  const clearedBalance = reconciledBase + checkedSum;
  const difference = clearedBalance - statementBalance;
  const isBalanced = difference === 0;

  function toggleRow(tx: Transaction) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(tx.id) ? next.delete(tx.id) : next.add(tx.id);
      return next;
    });
  }

  async function handleFinish() {
    if (!id || checkedIds.size === 0) return;
    await reconcileAccount.mutateAsync({ accountId: id, transactionIds: [...checkedIds] });
    navigate(`/accounts/${id}`);
  }

  async function handleCreateAdjustment() {
    if (!id || !account) return;
    const adjustmentAmount = statementBalance - clearedBalance;
    const created = await createTransaction.mutateAsync({
      accountId: id,
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: adjustmentAmount,
      notes: 'Reconciliation adjustment',
      cleared: 1,
    });
    const idsToReconcile = [...checkedIds, created.id];
    await reconcileAccount.mutateAsync({ accountId: id, transactionIds: idsToReconcile });
    navigate(`/accounts/${id}`);
  }

  if (!account) return null;

  // ── Step 1: Enter statement balance ──────────────────────────────────────
  if (step === 1) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/accounts/${id}`)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800">Reconcile: {account.name}</h1>
              <Badge variant={account.type} />
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center pt-16 px-6">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Enter your bank's ending balance</h2>
              <p className="text-sm text-gray-500">Check your bank statement or online banking for the current balance.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Statement Balance</label>
              <CurrencyInput
                value={statementBalance}
                onChange={setStatementBalance}
                className="w-full text-lg"
              />
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400">Current cleared balance in app</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(clearedBalance)}</p>
            </div>

            <button
              onClick={startStep2}
              disabled={isLoading}
              className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Start Reconciliation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Check off transactions ───────────────────────────────────────
  const sorted = [...unreconciledTxns].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep(1)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800">Reconcile: {account.name}</h1>
            <Badge variant={account.type} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: transaction checklist */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide w-24">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Payee</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-28">Amount</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-12">✓</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No unreconciled transactions.</td></tr>
              ) : sorted.map(tx => {
                const checked = checkedIds.has(tx.id);
                return (
                  <tr
                    key={tx.id}
                    onClick={() => toggleRow(tx)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${checked ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {format(parseISO(tx.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-900">
                      {tx.payeeName ?? <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-sm text-right tabular-nums font-medium ${tx.amount < 0 ? 'text-gray-900' : 'text-green-600'}`}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
                        checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                      }`}>
                        {checked && <Check size={10} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right: sticky summary */}
        <div className="w-64 shrink-0 border-l border-gray-100 flex flex-col">
          <div className="flex-1 px-5 py-6 space-y-5">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Cleared Balance</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(clearedBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Statement Balance</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(statementBalance)}</p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Difference</p>
              <p className={`text-2xl font-bold tabular-nums ${isBalanced ? 'text-green-600' : 'text-red-500'}`}>
                {formatCurrency(difference)}
              </p>
              {isBalanced && (
                <p className="text-xs text-green-600 mt-1">Ready to finish!</p>
              )}
            </div>
          </div>

          <div className="px-5 py-5 space-y-2 border-t border-gray-100">
            <button
              onClick={handleFinish}
              disabled={!isBalanced || reconcileAccount.isPending || checkedIds.size === 0}
              className="w-full py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {reconcileAccount.isPending ? 'Saving…' : 'Finish ✓'}
            </button>
            {!isBalanced && (
              <button
                onClick={handleCreateAdjustment}
                disabled={reconcileAccount.isPending || createTransaction.isPending}
                className="w-full py-2.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Create Adjustment
              </button>
            )}
            <button
              onClick={() => navigate(`/accounts/${id}`)}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
