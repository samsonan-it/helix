import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getProject } from '../api/execution.api';

export function useProject(id: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id ?? ''),
    queryFn: () => getProject(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}
