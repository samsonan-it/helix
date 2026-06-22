import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminCostCentres } from '../api/adminReferenceData.api';

export function useAdminCostCentres() {
  return useQuery({
    queryKey: queryKeys.referenceData.adminCostCentres(),
    queryFn: listAdminCostCentres,
  });
}
