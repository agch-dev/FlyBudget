import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as accountsApi from '../api/accounts';
import { useUndoStore } from '../store/undoStore';
import type { Account } from '../types';
import type { ImportMemory } from '../utils/csv';
import { t } from '../i18n';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAccounts,
  });
}

/** Under 'accounts', so the offline copy keeps it with the rest of the budget */
export const importSettingsKey = (accountId: string) =>
  ['accounts', accountId, 'import-settings'] as const;

export const importSettingsQuery = (accountId: string) => ({
  queryKey: importSettingsKey(accountId),
  queryFn: () => accountsApi.getImportSettings(accountId),
});

/** How the account's bank files were read last time; loaded while the import dialog is open */
export function useImportSettings(accountId: string, enabled: boolean) {
  return useQuery({ ...importSettingsQuery(accountId), enabled });
}

/**
 * Remembers an import's choices for the account. Shown at once (the next file opened uses
 * them); a save that fails is put back to what the server has, and never undoes the import.
 */
export function useSaveImportSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, settings }: { accountId: string; settings: ImportMemory }) =>
      accountsApi.saveImportSettings(accountId, settings),
    onMutate: async ({ accountId, settings }) => {
      await qc.cancelQueries({ queryKey: importSettingsKey(accountId) });
      qc.setQueryData(importSettingsKey(accountId), { settings });
    },
    onSuccess: (saved, { accountId }) => qc.setQueryData(importSettingsKey(accountId), saved),
    onError: (_, { accountId }) => qc.invalidateQueries({ queryKey: importSettingsKey(accountId) }),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.createAccount,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      useUndoStore.getState().push({
        description: () => t('accounts:undo.create', { name: created.name }),
        undo: async () => {
          await accountsApi.closeAccount(created.id);
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          await accountsApi.createAccount({
            name: created.name,
            type: created.type,
            startingBalance: created.startingBalance,
            isOffBudget: created.isOffBudget,
            currency: created.currency,
          });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof accountsApi.updateAccount>[1];
    }) => accountsApi.updateAccount(id, data),
    onMutate: async ({ id }) => {
      const accounts = qc.getQueryData<Account[]>(['accounts']);
      return { old: accounts?.find((a) => a.id === id) };
    },
    onSuccess: (_, { id, data }, ctx) => {
      // A new currency moves the account in or out of every combined total
      if (data.currency) qc.invalidateQueries();
      else qc.invalidateQueries({ queryKey: ['accounts'] });
      if (!ctx?.old) return;
      const snapshot = ctx.old;
      useUndoStore.getState().push({
        description: () => t('accounts:undo.edit'),
        undo: async () => {
          await accountsApi.updateAccount(id, {
            name: snapshot.name,
            type: snapshot.type,
            isOffBudget: snapshot.isOffBudget,
          });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          await accountsApi.updateAccount(id, data);
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}

export function useCloseAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const accounts = qc.getQueryData<Account[]>(['accounts']);
      const snapshot = accounts?.find((a) => a.id === id);
      return accountsApi.closeAccount(id).then(() => snapshot);
    },
    onSuccess: (snapshot) => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      if (!snapshot) return;
      useUndoStore.getState().push({
        description: () => t('accounts:undo.close', { name: snapshot.name }),
        undo: async () => {
          await accountsApi.updateAccount(snapshot.id, { name: snapshot.name });
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          await accountsApi.closeAccount(snapshot.id);
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}

export function useBalancesAgo() {
  return useQuery({
    queryKey: ['accounts', 'balances-ago'],
    queryFn: accountsApi.getBalancesAgo,
  });
}

export function useReorderAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => {
      const accounts = qc.getQueryData<Account[]>(['accounts']);
      const oldIds = accounts?.map((a) => a.id) ?? [];
      return accountsApi.reorderAccounts(ids).then(() => oldIds);
    },
    onSuccess: (oldIds, newIds) => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      useUndoStore.getState().push({
        description: () => t('accounts:undo.reorder'),
        undo: async () => {
          await accountsApi.reorderAccounts(oldIds);
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
        redo: async () => {
          await accountsApi.reorderAccounts(newIds);
          qc.invalidateQueries({ queryKey: ['accounts'] });
        },
      });
    },
  });
}
