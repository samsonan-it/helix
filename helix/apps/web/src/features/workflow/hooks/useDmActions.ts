import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import {
  acceptDemand,
  returnDemand,
  rejectDemand,
  postponeDemand,
  resumeDemand,
} from '../api/workflow.api';
import type { DmAcceptDto, DmReturnDto, DmRejectDto, DmPostponeDto } from '@helix/shared';

function useInvalidate(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.demands.unifiedQueueAll() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.all() });
    qc.invalidateQueries({ queryKey: queryKeys.demands.detail(id) });
  };
}

export function useDmAccept(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: DmAcceptDto) => acceptDemand(demandId, body),
    onSuccess: invalidate,
  });
}

export function useDmReturn(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: DmReturnDto) => returnDemand(demandId, body),
    onSuccess: invalidate,
  });
}

export function useDmReject(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: DmRejectDto) => rejectDemand(demandId, body),
    onSuccess: invalidate,
  });
}

export function useDmPostpone(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: (body: DmPostponeDto) => postponeDemand(demandId, body),
    onSuccess: invalidate,
  });
}

export function useDmResume(demandId: string) {
  const invalidate = useInvalidate(demandId);
  return useMutation({
    mutationFn: () => resumeDemand(demandId),
    onSuccess: invalidate,
  });
}
