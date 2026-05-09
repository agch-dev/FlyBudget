import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/customReports';
import type { CustomReportConfig } from '../types';

export function useCustomReportData(config: CustomReportConfig) {
  return useQuery({
    queryKey: ['reports', 'custom', config],
    queryFn: () => api.getCustomReportData(config),
  });
}

export function useSavedReports() {
  return useQuery({ queryKey: ['custom-reports'], queryFn: api.getSavedReports });
}

export function useSavedReport(id: string | undefined) {
  return useQuery({
    queryKey: ['custom-reports', id],
    queryFn: () => api.getSavedReport(id!),
    enabled: !!id,
  });
}

export function useCreateSavedReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSavedReport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-reports'] }),
  });
}

export function useUpdateSavedReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; config?: CustomReportConfig } }) =>
      api.updateSavedReport(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-reports'] }),
  });
}

export function useDeleteSavedReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSavedReport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-reports'] }),
  });
}
