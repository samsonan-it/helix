import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { updateSystemConfig } from '../api/systemConfig.api';

export function useUpdateSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSystemConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.systemSettings.all() });
    },
  });
}
