import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { updateCurrentStage } from '../api/execution.api';

export function useUpdateCurrentStage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, comment }: { stage: string; comment?: string }) => updateCurrentStage(projectId, stage, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.list({}) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.history(projectId) });
    },
  });
}
