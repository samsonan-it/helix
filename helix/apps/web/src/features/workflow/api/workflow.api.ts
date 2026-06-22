import { api } from '../../../lib/api';
import type { DemandResponse, DashboardStatsResponse, UnifiedQueueItem, DemandHistoryItem, DmAcceptDto, DmReturnDto, DmRejectDto, DmPostponeDto, PmSendBackDto, SpReworkOfferDto } from '@helix/shared';

export async function acceptDemand(id: string, body: DmAcceptDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/accept`, body);
  return data;
}

export async function returnDemand(id: string, body: DmReturnDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/return`, body);
  return data;
}

export async function rejectDemand(id: string, body: DmRejectDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/reject`, body);
  return data;
}

export async function postponeDemand(id: string, body: DmPostponeDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/postpone`, body);
  return data;
}

export async function resumeDemand(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/resume`);
  return data;
}

export async function getDemand(id: string): Promise<DemandResponse> {
  const { data } = await api.get<DemandResponse>(`/demands/${id}`);
  return data;
}

export async function approveDemand(id: string, body: { assignedPmId?: string }): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/approve`, body);
  return data;
}

export async function pmRejectDemand(id: string, body: { pmCommentary: string }): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/pm-reject`, body);
  return data;
}

export async function pmSendBackDemand(id: string, body: PmSendBackDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/pm-send-back`, body);
  return data;
}

export async function getDemandHistory(id: string): Promise<DemandHistoryItem[]> {
  const { data } = await api.get<DemandHistoryItem[]>(`/demands/${id}/history`);
  return data;
}

export async function getMyDemands(params: { limit?: number; publicId?: number } = {}): Promise<DemandResponse[]> {
  const query = params.publicId !== undefined ? `?publicId=${params.publicId}` : '';
  const { data } = await api.get<DemandResponse[]>(`/demands${query}`);
  return params.limit ? data.slice(0, params.limit) : data;
}

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  const { data } = await api.get<DashboardStatsResponse>('/demands/dashboard-stats');
  return data;
}

export async function spAcceptDemand(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/sp-accept`);
  return data;
}

export async function spSubmitEstimate(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/sp-submit-estimate`);
  return data;
}

export async function spAcceptAndEstimate(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/sp-accept-and-estimate`);
  return data;
}

export async function spAcceptOffer(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/sp-accept-offer`);
  return data;
}

export async function spReworkOffer(id: string, body: SpReworkOfferDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/sp-rework-offer`, body);
  return data;
}

export async function convertToSmallProject(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/convert-to-sp`);
  return data;
}

export interface UnifiedQueueFilters {
  search?: string;
  stalledOnly?: boolean;
  onHoldOnly?: boolean;
}

export async function getUnifiedQueue(filters: UnifiedQueueFilters = {}): Promise<UnifiedQueueItem[]> {
  const params: Record<string, string> = {};
  if (filters.search) params['search'] = filters.search;
  if (filters.stalledOnly) params['stalledOnly'] = 'true';
  if (filters.onHoldOnly) params['onHoldOnly'] = 'true';
  const { data } = await api.get<UnifiedQueueItem[]>('/demands/unified-queue', { params });
  return data;
}
