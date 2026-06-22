import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { bcApproveDemand, bcRejectDemand, bcSendToRequester } from '../api/bcActions.api';
import type { BcRejectDto, BcSendToRequesterDto } from '@helix/shared';

function useInvalidate(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.demands.unifiedQueueAll() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.all() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.detail(id) });
  };
}

export function useBcApprove(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: () => bcApproveDemand(demandId),
    onSuccess: invalidate,
  });
}

export function useBcReject(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: BcRejectDto) => bcRejectDemand(demandId, body),
    onSuccess: invalidate,
  });
}

export function useBcSendToRequester(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: BcSendToRequesterDto) => bcSendToRequester(demandId, body),
    onSuccess: invalidate,
  });
}
