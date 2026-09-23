import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as budgetApi from '../api/budget';

export function useBudget(month: string) {
  return useQuery({ queryKey: ['budget', month], queryFn: () => budgetApi.getBudget(month) });
}

export function useBudgetSummary(month: string) {
  return useQuery({ queryKey: ['budget-summary', month], queryFn: () => budgetApi.getBudgetSummary(month) });
}

export function useSetBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, categoryId, budgeted }: { month: string; categoryId: string; budgeted: number }) =>
      budgetApi.setBudget(month, categoryId, budgeted),
    onSuccess: (_, { month }) => {
      qc.invalidateQueries({ queryKey: ['budget', month] });
      qc.invalidateQueries({ queryKey: ['budget-summary', month] });
    },
  });
}

export function useCategoryHistory(categoryId: string | null, currentMonth?: string) {
  return useQuery({
    queryKey: ['category-history', categoryId, currentMonth],
    queryFn: () => budgetApi.getCategoryHistory(categoryId!, currentMonth),
    enabled: !!categoryId,
  });
}

export function useSetBudgetBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, budgeted, fromMonth }: { categoryId: string; budgeted: number; fromMonth: string }) =>
      budgetApi.setBudgetBulk(categoryId, budgeted, fromMonth),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget'] });
      qc.invalidateQueries({ queryKey: ['budget-summary'] });
    },
  });
}
