import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminCountries } from '../api/adminReferenceData.api';

export function useAdminCountries() {
  return useQuery({
    queryKey: queryKeys.referenceData.adminCountries(),
    queryFn: listAdminCountries,
  });
}
