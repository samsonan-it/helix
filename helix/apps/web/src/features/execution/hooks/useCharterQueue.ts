import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getCharterQueue } from '../api/execution.api';

export function useCharterQueue(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.charterQueue(),
    queryFn: getCharterQueue,
    staleTime: 0,
    enabled: options?.enabled !== false,
  });
}
