import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getRoutingHealth } from '../api/admin.api';

export function useRoutingHealth() {
  return useQuery<ReturnType<typeof getRoutingHealth> extends Promise<infer T> ? T : never>({
    queryKey: queryKeys.admin.routingHealth(),
    queryFn: getRoutingHealth,
  });
}
