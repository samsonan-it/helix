import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { approveCharter } from '../api/execution.api';

export function useApproveCharter(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => approveCharter(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.charterQueue() });
    },
  });
}
