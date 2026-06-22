import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getUnifiedQueue, type UnifiedQueueFilters } from '../api/workflow.api';

export function useUnifiedQueue(filters: UnifiedQueueFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.demands.unifiedQueue(filters),
    queryFn: () => getUnifiedQueue(filters),
    enabled,
  });
}
