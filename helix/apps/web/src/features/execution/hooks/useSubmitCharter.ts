import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { submitCharter } from '../api/execution.api';

export function useSubmitCharter(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitCharter(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.list({}) });
    },
  });
}
