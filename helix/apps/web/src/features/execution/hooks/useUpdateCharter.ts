import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { updateCharter, UpdateCharterRequest } from '../api/execution.api';

export function useUpdateCharter(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCharterRequest) => updateCharter(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}
