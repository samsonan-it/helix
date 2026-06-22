import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { submitStatusReport, CreateStatusReportRequest } from '../api/execution.api';

export function useSubmitStatusReport(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStatusReportRequest) => submitStatusReport(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.statusReports.byProject(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
    },
  });
}
