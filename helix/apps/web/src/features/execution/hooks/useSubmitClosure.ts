import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { submitClosure, type ClosureSubmitRequest } from '../api/execution.api';

export function useSubmitClosure(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: ClosureSubmitRequest) => submitClosure(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
    },
  });
}
