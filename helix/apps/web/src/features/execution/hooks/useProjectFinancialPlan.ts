import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getProjectFinancialPlan, patchProjectFinancialPlan, UpdateFinancialPlanEntriesDto } from '../api/execution.api';

export function useProjectFinancialPlan(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.financialPlans.byProject(projectId ?? ''),
    queryFn: () => getProjectFinancialPlan(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function usePatchProjectFinancialPlan(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateFinancialPlanEntriesDto) => patchProjectFinancialPlan(projectId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialPlans.byProject(projectId) });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialPlans.byProject(projectId) });
    },
  });
}
