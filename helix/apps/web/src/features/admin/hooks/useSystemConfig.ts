import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getSystemConfig } from '../api/systemConfig.api';

export function useSystemConfig() {
  return useQuery({
    queryKey: queryKeys.systemSettings.all(),
    queryFn:  getSystemConfig,
  });
}
