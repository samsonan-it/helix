import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { acceptClosure } from '../api/execution.api';

export function useAcceptClosure(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => acceptClosure(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.closureQueue() });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
    },
  });
}
