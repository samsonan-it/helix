import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { returnClosure } from '../api/execution.api';

export function useReturnClosure(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment: string) => returnClosure(projectId, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.closureQueue() });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
    },
  });
}
