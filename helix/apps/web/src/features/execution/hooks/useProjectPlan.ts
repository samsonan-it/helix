import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getProjectPlan } from '../api/execution.api';

export function useProjectPlan(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.plan(projectId),
    queryFn: () => getProjectPlan(projectId),
    enabled: !!projectId,
  });
}
