import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { getUsersByRole } from '../lib/users.api';

export function useUsersByRole(role: string) {
  return useQuery({
    queryKey: queryKeys.users.byRole(role),
    queryFn: () => getUsersByRole(role),
    staleTime: 5 * 60 * 1000,
  });
}
