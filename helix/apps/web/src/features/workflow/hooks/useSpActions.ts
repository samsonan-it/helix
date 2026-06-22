import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { spAcceptDemand, spSubmitEstimate, spAcceptOffer, spReworkOffer, spAcceptAndEstimate, convertToSmallProject } from '../api/workflow.api';
import type { SpReworkOfferDto } from '@helix/shared';

function useInvalidate(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.demands.unifiedQueueAll() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.all() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.detail(id) });
  };
}

export function useSpAccept(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: () => spAcceptDemand(demandId),
    onSuccess: invalidate,
  });
}

export function useSpSubmitEstimate(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: () => spSubmitEstimate(demandId),
    onSuccess: invalidate,
  });
}

export function useSpAcceptAndEstimate(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: () => spAcceptAndEstimate(demandId),
    onSuccess: invalidate,
  });
}

export function useSpAcceptOffer(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: () => spAcceptOffer(demandId),
    onSuccess: invalidate,
  });
}

export function useSpReworkOffer(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: SpReworkOfferDto) => spReworkOffer(demandId, body),
    onSuccess: invalidate,
  });
}

export function useConvertToSmallProject(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: () => convertToSmallProject(demandId),
    onSuccess: invalidate,
  });
}
