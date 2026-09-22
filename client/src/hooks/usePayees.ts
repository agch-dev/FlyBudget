import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as payeesApi from '../api/payees';

const QK = ['payees'];

export function usePayees() {
  return useQuery({ queryKey: QK, queryFn: payeesApi.getPayees });
}

export function useCreatePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, defaultCategoryId }: { name: string; defaultCategoryId?: string | null }) =>
      payeesApi.createPayee(name, defaultCategoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdatePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; defaultCategoryId?: string | null }) =>
      payeesApi.updatePayee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeletePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payeesApi.deletePayee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useMergePayees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ keepId, mergeIds }: { keepId: string; mergeIds: string[] }) =>
      payeesApi.mergePayees(keepId, mergeIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
