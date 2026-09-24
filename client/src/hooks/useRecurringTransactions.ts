import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/recurringTransactions';
import { deleteTransaction } from '../api/transactions';
import { useUndoStore } from '../store/undoStore';
import type { CreateRecurringData } from '../api/recurringTransactions';
import type { RecurringTransaction } from '../types';

const RQK = ['recurring-transactions'];
const OQK = ['recurring-occurrences'];
const SQK = ['recurring-summary'];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: RQK });
  qc.invalidateQueries({ queryKey: OQK });
  qc.invalidateQueries({ queryKey: SQK });
}

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
    onSuccess: (created) => {
      invalidateAll(qc);
      useUndoStore.getState().push({
        description: `Create recurring "${created.title}"`,
        undo: async () => {
          await api.deleteRecurringTransaction(created.id, true);
          invalidateAll(qc);
        },
        redo: async () => {
          await api.createRecurringTransaction({
            title: created.title,
            amount: created.amount,
            isApproximate: created.isApproximate,
            frequency: created.frequency,
            startDate: created.startDate,
            endDate: created.endDate,
            accountId: created.accountId,
            categoryId: created.categoryId,
            payeeId: created.payeeId,
            notes: created.notes,
            autoCreate: created.autoCreate,
          });
          invalidateAll(qc);
        },
      });
    },
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateRecurringData>) =>
      api.updateRecurringTransaction(id, data),
    onMutate: async ({ id }) => {
      const all = qc.getQueryData<RecurringTransaction[]>(['recurring-transactions', { status: undefined }]);
      const active = qc.getQueryData<RecurringTransaction[]>(['recurring-transactions', { status: 'active' }]);
      const snapshot = all?.find((r) => r.id === id) ?? active?.find((r) => r.id === id);
      return { old: snapshot };
    },
    onSuccess: (_, { id, ...data }, ctx) => {
      invalidateAll(qc);
      if (!ctx?.old) return;
      const snapshot = ctx.old;
      useUndoStore.getState().push({
        description: `Edit recurring`,
        undo: async () => {
          await api.updateRecurringTransaction(id, {
            title: snapshot.title,
            amount: snapshot.amount,
            isApproximate: snapshot.isApproximate,
            frequency: snapshot.frequency,
            startDate: snapshot.startDate,
            endDate: snapshot.endDate,
            accountId: snapshot.accountId,
            categoryId: snapshot.categoryId,
            payeeId: snapshot.payeeId,
            notes: snapshot.notes,
            autoCreate: snapshot.autoCreate,
            status: snapshot.status,
          });
          invalidateAll(qc);
        },
        redo: async () => {
          await api.updateRecurringTransaction(id, data);
          invalidateAll(qc);
        },
      });
    },
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hard }: { id: string; hard?: boolean }) => {
      const all = qc.getQueryData<RecurringTransaction[]>(['recurring-transactions', { status: undefined }]);
      const snapshot = all?.find((r) => r.id === id);
      return api.deleteRecurringTransaction(id, hard).then(() => ({ snapshot, hard }));
    },
    onSuccess: ({ snapshot, hard }) => {
      invalidateAll(qc);
      if (!snapshot) return;
      if (!hard) {
        useUndoStore.getState().push({
          description: `Cancel recurring "${snapshot.title}"`,
          undo: async () => {
            await api.updateRecurringTransaction(snapshot.id, { status: 'active' });
            invalidateAll(qc);
          },
          redo: async () => {
            await api.deleteRecurringTransaction(snapshot.id);
            invalidateAll(qc);
          },
        });
      }
    },
  });
}

export function useMarkAsPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, amount }: { id: string; date: string; amount?: number }) =>
      api.markAsPaid(id, date, amount),
    onSuccess: (createdTx) => {
      qc.invalidateQueries({ queryKey: OQK });
      qc.invalidateQueries({ queryKey: SQK });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      useUndoStore.getState().push({
        description: `Mark as paid`,
        undo: async () => {
          await deleteTransaction(createdTx.id);
          qc.invalidateQueries({ queryKey: OQK });
          qc.invalidateQueries({ queryKey: SQK });
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          qc.invalidateQueries({ queryKey: OQK });
          qc.invalidateQueries({ queryKey: SQK });
          qc.invalidateQueries({ queryKey: ['transactions'] });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}
