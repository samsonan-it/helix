import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { replaceProjectPlan, ReplaceProjectPlanRequest } from '../api/execution.api';

export function useReplaceProjectPlan(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: ReplaceProjectPlanRequest) => replaceProjectPlan(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.plan(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}
