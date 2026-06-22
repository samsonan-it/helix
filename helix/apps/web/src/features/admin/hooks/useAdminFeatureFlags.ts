import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminFeatureFlags } from '../api/adminFeatureFlags.api';

export function useAdminFeatureFlags() {
  return useQuery({
    queryKey: queryKeys.admin.featureFlags(),
    queryFn: listAdminFeatureFlags,
  });
}
