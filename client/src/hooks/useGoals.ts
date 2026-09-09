import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as goalsApi from '../api/goals';

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: goalsApi.getGoals,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: goalsApi.createGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof goalsApi.updateGoal>[1] }) =>
      goalsApi.updateGoal(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: goalsApi.deleteGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}
