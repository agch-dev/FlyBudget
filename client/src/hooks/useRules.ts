import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as rulesApi from '../api/rules';
import type { RuleCondition, RuleAction } from '../types';

const QK = ['rules'];

export function useRules() {
  return useQuery({ queryKey: QK, queryFn: rulesApi.getRules });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { conditions: RuleCondition[]; actions: RuleAction[]; sortOrder?: number }) =>
      rulesApi.createRule(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; conditions?: RuleCondition[]; actions?: RuleAction[] }) =>
      rulesApi.updateRule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rulesApi.deleteRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useReorderRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => rulesApi.reorderRules(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useRunRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rulesApi.runRules,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}
