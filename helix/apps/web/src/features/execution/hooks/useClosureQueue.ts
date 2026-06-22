import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getClosureQueue } from '../api/execution.api';

export function useClosureQueue(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.closureQueue(),
    queryFn: getClosureQueue,
    staleTime: 0,
    enabled: options?.enabled !== false,
  });
}
