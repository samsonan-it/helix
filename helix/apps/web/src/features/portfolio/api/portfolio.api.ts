import { DemandStatus } from '@helix/shared';
import { api } from '../../../lib/api';

export interface PortfolioFilters {
  preset?: string;
  year?: number;
  status?: string;
  demandType?: 'P' | 'SP';
  pmId?: string;
  areaId?: string;
  page?: number;
  pageSize?: number;
}

export interface PortfolioItem {
  id: string;
  publicId: number;
  title: string;
  demandType: 'P' | 'SP';
  projectType: string | null;
  investmentApproval: string | null;
  startDate: string | null;
  endDate: string | null;
  itProjectManager: { id: string; name: string; email: string } | null;
  status: DemandStatus;
  eligibleForPpp: boolean;
  demandPriority: string | null;
  isInflight: boolean;
  relevantYear: number | null;
  forecastOpex: number;
  totalCapex: number;
  totalCosts: number;
  monthlyOpex: Record<string, number>;
}

export interface PortfolioListResponse {
  data: PortfolioItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getPortfolioList(filters: PortfolioFilters = {}): Promise<PortfolioListResponse> {
  const params: Record<string, string> = {};
  if (filters.preset)     params['preset']     = filters.preset;
  if (filters.year)       params['year']        = String(filters.year);
  if (filters.status)     params['status']      = filters.status;
  if (filters.demandType) params['demandType']  = filters.demandType;
  if (filters.pmId)       params['pmId']        = filters.pmId;
  if (filters.areaId)     params['areaId']      = filters.areaId;
  if (filters.page)       params['page']        = String(filters.page);
  if (filters.pageSize)   params['pageSize']    = String(filters.pageSize);
  const { data } = await api.get<PortfolioListResponse>('/portfolio', { params });
  return data;
}
