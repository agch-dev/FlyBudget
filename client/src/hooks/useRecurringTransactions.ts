import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/recurringTransactions';
import type { CreateRecurringData } from '../api/recurringTransactions';

export function useRecurringTransactions(status?: string) {
  return useQuery({
    queryKey: ['recurring-transactions', { status }],
    queryFn: () => api.getRecurringTransactions(status),
  });
}

export function useOccurrences(from: string, to: string) {
  return useQuery({
    queryKey: ['recurring-occurrences', { from, to }],
    queryFn: () => api.getOccurrences(from, to),
    enabled: Boolean(from && to),
  });
}

export function useRecurringSummary(month: string) {
  return useQuery({
    queryKey: ['recurring-summary', month],
    queryFn: () => api.getRecurringSummary(month),
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringData) => api.createRecurringTransaction(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-transactions'] });
      qc.invalidateQueries({ queryKey: ['recurring-occurrences'] });
      qc.invalidateQueries({ queryKey: ['recurring-summary'] });
    },
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateRecurringData>) =>
      api.updateRecurringTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-transactions'] });
      qc.invalidateQueries({ queryKey: ['recurring-occurrences'] });
      qc.invalidateQueries({ queryKey: ['recurring-summary'] });
    },
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hard }: { id: string; hard?: boolean }) =>
      api.deleteRecurringTransaction(id, hard),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-transactions'] });
      qc.invalidateQueries({ queryKey: ['recurring-occurrences'] });
      qc.invalidateQueries({ queryKey: ['recurring-summary'] });
    },
  });
}

export function useMarkAsPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, amount }: { id: string; date: string; amount?: number }) =>
      api.markAsPaid(id, date, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-occurrences'] });
      qc.invalidateQueries({ queryKey: ['recurring-summary'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
