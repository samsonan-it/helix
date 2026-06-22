import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DemandStatus } from '@helix/shared';
import { Role } from '@helix/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PortfolioService } from '../../src/portfolio/portfolio.service';

const GLOBAL_PM = { id: 'pm-global', email: 'pm@stada.dev', name: 'Jasmina', roles: [Role.PortfolioManager] };

function makeDemand(overrides: Record<string, unknown> = {}) {
  return {
    id: 'demand-1',
    title: 'Test Demand',
    status: DemandStatus.IN_REVIEW,
    isSmallProject: false,
    projectType: null,
    investmentApproval: null,
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-12-31'),
    submittedAt: new Date('2026-01-10'),
    eligibleForPpp: false,
    demandPriority: null,
    itProjectManager: null,
    financialPlanEntries: [],
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAssignment(scopeType = 'global', scopeId: string | null = null) {
  return { scopeType, scopeId };
}

describe('PortfolioService', () => {
  let service: PortfolioService;
  let prisma: {
    userRoleAssignment: { findMany: jest.Mock };
    demand: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      userRoleAssignment: { findMany: jest.fn() },
      demand: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
  });

  describe('getPortfolioList — scope resolution', () => {
    it('returns empty list when PM has no role assignments', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([]);
      const result = await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ACTIVE', page: 1, pageSize: 50 });
      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 50 });
      expect(prisma.demand.findMany).not.toHaveBeenCalled();
    });

    it('returns empty list when PM has no cost-centre assignments and is not global', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([makeAssignment('cost-centre', null)]);
      const result = await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ACTIVE', page: 1, pageSize: 50 });
      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 50 });
    });

    it('global PM does NOT add costCentreId filter', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([makeAssignment('global')]);
      prisma.demand.findMany.mockResolvedValue([]);
      prisma.demand.count.mockResolvedValue(0);
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 50 });
      const whereArg = prisma.demand.findMany.mock.calls[0][0].where;
      const hasCostCentreFilter = JSON.stringify(whereArg).includes('costCentreId');
      expect(hasCostCentreFilter).toBe(false);
    });

    it('scoped PM adds costCentreId filter', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([makeAssignment('cost-centre', 'cc-1')]);
      prisma.demand.findMany.mockResolvedValue([]);
      prisma.demand.count.mockResolvedValue(0);
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 50 });
      const whereArg = prisma.demand.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(whereArg)).toContain('costCentreId');
    });
  });

  describe('getPortfolioList — preset filtering', () => {
    beforeEach(() => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([makeAssignment('global')]);
      prisma.demand.count.mockResolvedValue(0);
      prisma.demand.findMany.mockResolvedValue([]);
    });

    it('ACTIVE preset filters by active statuses', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ACTIVE', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('IN_REVIEW');
      expect(whereStr).toContain('SUBMITTED');
    });

    it('PENDING_APPROVAL preset filters by IN_REVIEW only', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'PENDING_APPROVAL', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('IN_REVIEW');
    });

    it('ON_HOLD preset filters by ON_HOLD only', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ON_HOLD', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('ON_HOLD');
    });

    it('ALL preset has no status filter', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 50 });
      const whereArg = prisma.demand.findMany.mock.calls[0][0].where;
      const andClauses = whereArg.AND as unknown[];
      const hasStatusClause = andClauses.some(
        (c) => JSON.stringify(c).includes('"status"'),
      );
      expect(hasStatusClause).toBe(false);
    });

    it('ad-hoc status overrides preset', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ACTIVE', status: 'APPROVED', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('APPROVED');
    });
  });

  describe('getPortfolioList — ad-hoc filters', () => {
    beforeEach(() => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([makeAssignment('global')]);
      prisma.demand.count.mockResolvedValue(0);
      prisma.demand.findMany.mockResolvedValue([]);
    });

    it('demandType SP maps to isSmallProject: true', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', demandType: 'SP', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('"isSmallProject":true');
    });

    it('demandType P maps to isSmallProject: false', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', demandType: 'P', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('"isSmallProject":false');
    });

    it('pmId filter sets itProjectManagerId', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', pmId: 'user-42', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('itProjectManagerId');
      expect(whereStr).toContain('user-42');
    });

    it('areaId filter sets areaId condition', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', areaId: 'area-1', page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('"areaId":"area-1"');
    });

    it('year filter adds OR date range clause', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', year: 2026, page: 1, pageSize: 50 });
      const whereStr = JSON.stringify(prisma.demand.findMany.mock.calls[0][0].where);
      expect(whereStr).toContain('startDate');
      expect(whereStr).toContain('submittedAt');
    });
  });

  describe('getPortfolioList — pagination', () => {
    beforeEach(() => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([makeAssignment('global')]);
      prisma.demand.count.mockResolvedValue(120);
      prisma.demand.findMany.mockResolvedValue([]);
    });

    it('returns correct page and pageSize in response', async () => {
      const result = await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 2, pageSize: 25 });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
      expect(result.total).toBe(120);
      expect(prisma.demand.findMany.mock.calls[0][0].skip).toBe(25);
      expect(prisma.demand.findMany.mock.calls[0][0].take).toBe(25);
    });

    it('caps pageSize at 100', async () => {
      await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 200 });
      expect(prisma.demand.findMany.mock.calls[0][0].take).toBe(100);
    });
  });

  describe('getPortfolioList — financial aggregation', () => {
    beforeEach(() => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([makeAssignment('global')]);
      prisma.demand.count.mockResolvedValue(1);
    });

    it('aggregates forecastOpex, totalCapex, totalCosts, and monthlyOpex correctly', async () => {
      const demand = makeDemand({
        financialPlanEntries: [
          { category: 'opex', month: 1, year: 2026, valueCents: 10000, isActual: false },
          { category: 'opex', month: 1, year: 2026, valueCents: 5000, isActual: false },
          { category: 'benefits', month: 2, year: 2026, valueCents: 3000, isActual: false },
          { category: 'capex', month: 1, year: 2026, valueCents: 20000, isActual: false },
        ],
      });
      prisma.demand.findMany.mockResolvedValue([demand]);
      const result = await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 50 });
      const item = result.data[0];
      expect(item.forecastOpex).toBe(18000);   // 10000 + 5000 + 3000
      expect(item.totalCapex).toBe(20000);
      expect(item.totalCosts).toBe(38000);     // 18000 + 20000
      expect(item.monthlyOpex['2026-01']).toBe(15000); // 10000 + 5000
      expect(item.monthlyOpex['2026-02']).toBe(3000);
    });

    it('sets isInflight true for IN_EXECUTION status', async () => {
      const demand = makeDemand({ status: DemandStatus.IN_EXECUTION, financialPlanEntries: [] });
      prisma.demand.findMany.mockResolvedValue([demand]);
      const result = await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 50 });
      expect(result.data[0].isInflight).toBe(true);
    });

    it('derives relevantYear from startDate', async () => {
      const demand = makeDemand({ startDate: new Date('2025-03-01'), submittedAt: new Date('2024-06-01'), financialPlanEntries: [] });
      prisma.demand.findMany.mockResolvedValue([demand]);
      const result = await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 50 });
      expect(result.data[0].relevantYear).toBe(2025);
    });

    it('falls back to submittedAt year when startDate is null', async () => {
      const demand = makeDemand({ startDate: null, submittedAt: new Date('2024-06-01'), financialPlanEntries: [] });
      prisma.demand.findMany.mockResolvedValue([demand]);
      const result = await service.getPortfolioList(GLOBAL_PM.id, { preset: 'ALL', page: 1, pageSize: 50 });
      expect(result.data[0].relevantYear).toBe(2024);
    });
  });
});
