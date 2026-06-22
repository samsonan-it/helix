import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getProjectList, ProjectFilters } from '../api/execution.api';

export function useProjectList(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: () => getProjectList(filters),
    staleTime: 30_000,
  });
}
