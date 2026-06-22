import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminUsers } from '../api/admin.api';

export function useAdminUsers(params?: { search?: string; role?: string; costCentreId?: string; areaId?: string }) {
  return useQuery({
    queryKey: queryKeys.admin.users(params),
    queryFn: () => listAdminUsers(params),
  });
}
