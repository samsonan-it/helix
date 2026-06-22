import { DemandStatus } from '@helix/shared';

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

export interface PortfolioListFilters {
  preset: string;
  year?: number;
  status?: string;
  demandType?: string;
  pmId?: string;
  areaId?: string;
  page: number;
  pageSize: number;
}
