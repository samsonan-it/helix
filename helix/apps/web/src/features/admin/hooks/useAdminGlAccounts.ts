import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminGlAccounts } from '../api/adminReferenceData.api';

export function useAdminGlAccounts() {
  return useQuery({
    queryKey: queryKeys.referenceData.adminGlAccounts(),
    queryFn: listAdminGlAccounts,
  });
}
