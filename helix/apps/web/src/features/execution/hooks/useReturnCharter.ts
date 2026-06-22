import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { returnCharter } from '../api/execution.api';

export function useReturnCharter(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment: string) => returnCharter(projectId, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.charterQueue() });
    },
  });
}
