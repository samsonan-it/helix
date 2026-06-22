import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DemandStatus } from '@helix/shared';
import { Role } from '@helix/types';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioItem, PortfolioListFilters, PortfolioListResponse } from './portfolio.types';

const ACTIVE_STATUSES: DemandStatus[] = [
  DemandStatus.SUBMITTED,
  DemandStatus.BC_REVIEW,
  DemandStatus.SP_OFFER_REVIEW,
  DemandStatus.IN_REVIEW,
  DemandStatus.ON_HOLD,
  DemandStatus.APPROVED,
  DemandStatus.IN_EXECUTION,
];

function presetToStatusFilter(preset: string): DemandStatus[] | DemandStatus | undefined {
  switch (preset) {
    case 'ACTIVE':           return ACTIVE_STATUSES;
    case 'PENDING_APPROVAL': return DemandStatus.IN_REVIEW;
    case 'ON_HOLD':          return DemandStatus.ON_HOLD;
    case 'ALL':              return undefined;
    default:                 return ACTIVE_STATUSES;
  }
}

type DemandWithEntries = Prisma.DemandGetPayload<{
  select: {
    id: true;
    publicId: true;
    title: true;
    status: true;
    isSmallProject: true;
    projectType: true;
    investmentApproval: true;
    startDate: true;
    endDate: true;
    submittedAt: true;
    eligibleForPpp: true;
    demandPriority: true;
    itProjectManager: { select: { id: true; name: true; email: true } };
    financialPlanEntries: { select: { category: true; month: true; year: true; valueCents: true; isActual: true } };
  };
}>;

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolvePmScope(pmId: string): Promise<{ isGlobal: boolean; costCentreIds: string[] | undefined }> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId: pmId, role: Role.PortfolioManager },
      select: { scopeType: true, scopeId: true },
    });
    const isGlobal = assignments.some((a) => a.scopeType === 'global');
    const costCentreIds = isGlobal
      ? undefined
      : (assignments.map((a) => a.scopeId).filter(Boolean) as string[]);
    return { isGlobal, costCentreIds };
  }

  async getPortfolioList(pmId: string, filters: PortfolioListFilters): Promise<PortfolioListResponse> {
    const { isGlobal, costCentreIds } = await this.resolvePmScope(pmId);
    if (!isGlobal && (!costCentreIds || costCentreIds.length === 0)) {
      return { data: [], total: 0, page: filters.page, pageSize: filters.pageSize };
    }

    const presetStatus = presetToStatusFilter(filters.preset);
    const page = Math.max(1, filters.page);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize));
    const skip = (page - 1) * pageSize;

    const where: Prisma.DemandWhereInput = {
      AND: [
        ...(costCentreIds ? [{ costCentreId: { in: costCentreIds } }] : []),
        ...(filters.status
          ? [{ status: filters.status as DemandStatus }]
          : Array.isArray(presetStatus)
            ? [{ status: { in: presetStatus } }]
            : presetStatus
              ? [{ status: presetStatus }]
              : []),
        ...(filters.demandType
          ? [{ isSmallProject: filters.demandType === 'SP' }]
          : []),
        ...(filters.pmId ? [{ itProjectManagerId: filters.pmId }] : []),
        ...(filters.areaId ? [{ areaId: filters.areaId }] : []),
        ...(filters.year
          ? [{
              OR: [
                { startDate: { gte: new Date(`${filters.year}-01-01`), lt: new Date(`${filters.year + 1}-01-01`) } },
                {
                  AND: [
                    { startDate: null },
                    { submittedAt: { gte: new Date(`${filters.year}-01-01`), lt: new Date(`${filters.year + 1}-01-01`) } },
                  ],
                },
              ],
            }]
          : []),
      ],
    };

    const [demands, total] = await Promise.all([
      this.prisma.demand.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          publicId: true,
          title: true,
          status: true,
          isSmallProject: true,
          projectType: true,
          investmentApproval: true,
          startDate: true,
          endDate: true,
          submittedAt: true,
          eligibleForPpp: true,
          demandPriority: true,
          itProjectManager: { select: { id: true, name: true, email: true } },
          financialPlanEntries: {
            select: { category: true, month: true, year: true, valueCents: true, isActual: true },
          },
        },
      }),
      this.prisma.demand.count({ where }),
    ]);

    return {
      data: demands.map((d) => this.mapToPortfolioItem(d)),
      total,
      page,
      pageSize,
    };
  }

  private mapToPortfolioItem(d: DemandWithEntries): PortfolioItem {
    let forecastOpex = 0;
    let totalCapex = 0;
    const monthlyOpex: Record<string, number> = {};

    for (const entry of d.financialPlanEntries) {
      const monthKey = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
      if (entry.category === 'opex' || entry.category === 'benefits') {
        forecastOpex += entry.valueCents;
        monthlyOpex[monthKey] = (monthlyOpex[monthKey] ?? 0) + entry.valueCents;
      } else if (entry.category === 'capex') {
        totalCapex += entry.valueCents;
      }
    }

    const relevantYear =
      d.startDate?.getFullYear() ??
      d.submittedAt?.getFullYear() ??
      null;

    return {
      id: d.id,
      publicId: d.publicId,
      title: d.title,
      demandType: d.isSmallProject ? 'SP' : 'P',
      projectType: d.projectType ?? null,
      investmentApproval: d.investmentApproval ?? null,
      startDate: d.startDate?.toISOString() ?? null,
      endDate: d.endDate?.toISOString() ?? null,
      itProjectManager: d.itProjectManager
        ? { id: d.itProjectManager.id, name: d.itProjectManager.name, email: d.itProjectManager.email }
        : null,
      status: d.status as DemandStatus,
      eligibleForPpp: d.eligibleForPpp,
      demandPriority: d.demandPriority ?? null,
      isInflight: d.status === DemandStatus.IN_EXECUTION,
      relevantYear,
      forecastOpex,
      totalCapex,
      totalCosts: forecastOpex + totalCapex,
      monthlyOpex,
    };
  }
}
