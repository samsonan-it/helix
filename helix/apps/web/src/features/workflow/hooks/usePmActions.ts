import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import type { PmSendBackDto } from '@helix/shared';
import { approveDemand, pmRejectDemand, pmSendBackDemand } from '../api/workflow.api';

function useInvalidate(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.demands.unifiedQueueAll() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.all() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.detail(id) });
  };
}

export function usePmApprove(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (vars: { assignedPmId?: string }) => approveDemand(demandId, vars),
    onSuccess: invalidate,
  });
}

export function usePmReject(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: { pmCommentary: string }) => pmRejectDemand(demandId, body),
    onSuccess: invalidate,
  });
}

export function usePmSendBack(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: PmSendBackDto) => pmSendBackDemand(demandId, body),
    onSuccess: invalidate,
  });
}
