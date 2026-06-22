import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminLegalEntities } from '../api/adminReferenceData.api';

export function useAdminLegalEntities() {
  return useQuery({
    queryKey: queryKeys.referenceData.adminLegalEntities(),
    queryFn: listAdminLegalEntities,
  });
}
