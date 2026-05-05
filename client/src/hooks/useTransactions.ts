import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as txApi from '../api/transactions';
import type { TransactionQueryParams } from '../types';

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof txApi.updateTransaction>[1] }) =>
      txApi.updateTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useToggleClearedTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cleared }: { id: string; cleared: 0 | 1 }) =>
      txApi.updateTransaction(id, { cleared }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: txApi.deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
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
