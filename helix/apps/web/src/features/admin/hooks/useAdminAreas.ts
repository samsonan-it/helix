import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminAreas } from '../api/adminReferenceData.api';

export function useAdminAreas() {
  return useQuery({
    queryKey: queryKeys.referenceData.adminAreas(),
    queryFn: listAdminAreas,
  });
}
