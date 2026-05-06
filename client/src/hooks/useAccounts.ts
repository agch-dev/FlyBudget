import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as accountsApi from '../api/accounts';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAccounts,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.createAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof accountsApi.updateAccount>[1] }) =>
      accountsApi.updateAccount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useCloseAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.closeAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useReorderAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.reorderAccounts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
