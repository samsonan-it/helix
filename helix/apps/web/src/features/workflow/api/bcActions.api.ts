import { api } from '../../../lib/api';
import type { BcRejectDto, BcSendToRequesterDto, DemandResponse } from '@helix/shared';

export async function bcApproveDemand(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/bc-approve`);
  return data;
}

export async function bcRejectDemand(id: string, body: BcRejectDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/bc-reject`, body);
  return data;
}

export async function bcSendToRequester(id: string, body: BcSendToRequesterDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/bc-send-to-requester`, body);
  return data;
}
