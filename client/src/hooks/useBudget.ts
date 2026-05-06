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
