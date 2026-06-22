import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getStatusReports, StatusReportItem } from '../api/execution.api';

export function useStatusReports(projectId: string | null) {
  return useQuery<StatusReportItem[]>({
    queryKey: queryKeys.statusReports.byProject(projectId ?? ''),
    queryFn: () => getStatusReports(projectId!),
    enabled: !!projectId,
  });
}
