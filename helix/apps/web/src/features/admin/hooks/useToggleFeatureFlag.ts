import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { toggleAdminFeatureFlag } from '../api/adminFeatureFlags.api';

export function useToggleFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      toggleAdminFeatureFlag(key, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.featureFlags() });
      void qc.invalidateQueries({ queryKey: queryKeys.flags.all() });
    },
  });
}
