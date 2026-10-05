import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as txApi from '../api/transactions';
import * as suggestionsApi from '../api/transferSuggestions';
import { useUndoStore } from '../store/undoStore';
import type { Transaction, TransactionQueryParams } from '../types';

function findTxInCache(qc: QueryClient, id: string): Transaction | undefined {
  const caches = qc.getQueriesData<Transaction[]>({ queryKey: ['transactions'] });
  for (const [, data] of caches) {
    const found = data?.find((t) => t.id === id);
    if (found) return found;
  }
}

export function useTransactions(params: TransactionQueryParams = {}) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => txApi.getTransactions(params),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: txApi.createTransaction,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      useUndoStore.getState().push({
        description: `Create transaction`,
        undo: async () => {
          await txApi.deleteTransaction(created.id);
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          await txApi.createTransaction({
            accountId: created.accountId,
            date: created.date,
            amount: created.amount,
            payeeId: created.payeeId,
            payeeName: created.payeeName,
            categoryId: created.categoryId,
            notes: created.notes,
          });
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof txApi.updateTransaction>[1];
    }) => txApi.updateTransaction(id, data),
    onMutate: async ({ id }) => {
      return { old: findTxInCache(qc, id) };
    },
    onSuccess: (_, { id, data }, ctx) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      if (!ctx?.old) return;
      const snapshot = ctx.old;
      useUndoStore.getState().push({
        description: `Edit transaction`,
        undo: async () => {
          await txApi.updateTransaction(id, {
            accountId: snapshot.accountId,
            date: snapshot.date,
            amount: snapshot.amount,
            payeeId: snapshot.payeeId,
            payeeName: snapshot.payeeName,
            categoryId: snapshot.categoryId,
            notes: snapshot.notes,
          });
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          await txApi.updateTransaction(id, data);
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const snapshot = findTxInCache(qc, id);
      return txApi.deleteTransaction(id).then(() => snapshot);
    },
    onSuccess: (snapshot) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      if (!snapshot) return;
      useUndoStore.getState().push({
        description: `Delete transaction`,
        undo: async () => {
          await txApi.createTransaction({
            accountId: snapshot.accountId,
            date: snapshot.date,
            amount: snapshot.amount,
            payeeId: snapshot.payeeId,
            payeeName: snapshot.payeeName,
            categoryId: snapshot.categoryId,
            notes: snapshot.notes,
          });
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          // Can't delete same id (new one was created), just re-delete latest
          // For simplicity, redo of delete is not supported after undo
          qc.invalidateQueries({ queryKey: ['transactions'] });
        },
      });
    },
  });
}

export function useReconcileAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, transactionIds }: { accountId: string; transactionIds: string[] }) =>
      txApi.reconcileAccount(accountId, transactionIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: txApi.createTransfer,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      const ids = created.map((t) => t.id);
      useUndoStore.getState().push({
        description: `Create transfer`,
        undo: async () => {
          for (const id of ids) await txApi.deleteTransaction(id);
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          if (created.length >= 2) {
            await txApi.createTransfer({
              fromAccountId: created[0].accountId,
              toAccountId: created[1].accountId,
              date: created[0].date,
              amount: Math.abs(created[0].amount),
              // Its own amount when the accounts have different currencies
              toAmount: Math.abs(created[1].amount),
              notes: created[0].notes,
            });
          }
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}

/** Transactions that could be the other side of `id` when linking it as a transfer */
export function useTransferCandidates(id: string, enabled = true) {
  return useQuery({
    queryKey: ['transactions', 'transfer-candidates', id],
    queryFn: () => txApi.getTransferCandidates(id),
    enabled,
  });
}

/** Linking and unlinking, with undo */
function useTransferLinkMutation<V>(
  description: string,
  run: (vars: V) => Promise<Transaction[]>,
  reverse: (sides: Transaction[], before: (Transaction | undefined)[]) => Promise<unknown>,
) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['accounts'] });
  };
  return useMutation({
    mutationFn: run,
    onSuccess: (sides, vars) => {
      // The categories each side had, to put back on undo
      const before = sides.map((t) => findTxInCache(qc, t.id));
      refresh();
      useUndoStore.getState().push({
        description,
        undo: async () => {
          await reverse(sides, before);
          refresh();
        },
        redo: async () => {
          await run(vars);
          refresh();
        },
      });
    },
  });
}

export function useLinkTransfer() {
  return useTransferLinkMutation(
    'Link as transfer',
    ({ id, otherTransactionId }: { id: string; otherTransactionId: string }) =>
      txApi.linkTransfer(id, otherTransactionId),
    async (sides, before) => {
      await txApi.unlinkTransfer(sides[0].id);
      for (const old of before) {
        if (old?.categoryId) await txApi.updateTransaction(old.id, { categoryId: old.categoryId });
      }
    },
  );
}

export function useUnlinkTransfer() {
  return useTransferLinkMutation(
    'Unlink transfer',
    (id: string) => txApi.unlinkTransfer(id),
    (sides) =>
      sides.length >= 2 && sides[0].id !== sides[1].id
        ? txApi.linkTransfer(sides[0].id, sides[1].id)
        : Promise.resolve(),
  );
}

const TRANSFER_SUGGESTIONS_KEY = ['transactions', 'transfer-suggestions'];

/**
 * Pairs of transactions that look like transfers. Under the `transactions` key, so anything
 * that changes transactions (an import above all) asks for them again. Confirm one with
 * `useLinkTransfer`.
 */
export function useTransferSuggestions() {
  return useQuery({
    queryKey: TRANSFER_SUGGESTIONS_KEY,
    queryFn: suggestionsApi.getTransferSuggestions,
  });
}

/** "Not a transfer": the pair is not suggested again */
export function useDismissTransferSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, otherTransactionId }: { id: string; otherTransactionId: string }) =>
      suggestionsApi.dismissTransferSuggestion(id, otherTransactionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRANSFER_SUGGESTIONS_KEY }),
  });
}

export function useImportConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, rows }: { accountId: string; rows: txApi.ImportRow[] }) =>
      txApi.importConfirm(accountId, rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
