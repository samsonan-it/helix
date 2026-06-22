import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FinancialPlansService } from '../../src/financial-plans/financial-plans.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@helix/types';

const DEMAND_ID = 'demand-cuid-1';
const REQUESTER_ID = 'user-cuid-1';
const GL_ACCOUNT_ID = 'gl-consultancy-1';

const requester = { id: REQUESTER_ID, email: 'dev@test.com', name: 'Dev', roles: [Role.DemandManager] };
const demandRequester = { id: REQUESTER_ID, email: 'dev@test.com', name: 'Dev', roles: [Role.DemandRequester] };

const baseEntry = (month: number, overrides = {}) => ({
  id: `entry-cuid-${month}`,
  demandId: DEMAND_ID,
  glAccountId: GL_ACCOUNT_ID,
  category: 'opex',
  year: 2026,
  month,
  valueCents: 0,
  isActual: false,
  isUserSet: false,
  ...overrides,
});

const baseDemand = (overrides = {}) => ({
  id: DEMAND_ID,
  isSmallProject: false,
  originatorId: REQUESTER_ID,
  ...overrides,
});

const glAccounts = [
  { id: GL_ACCOUNT_ID, categories: ['opex'], name: 'IT Consultancy', isActive: true },
];

const PROJECT_ID = 'project-cuid-1';
const ASSIGNED_PM_ID = 'pm-cuid-1';
const OTHER_USER_ID = 'other-user-cuid-2';

const baseProject = (overrides = {}) => ({
  id: PROJECT_ID,
  assignedPmId: ASSIGNED_PM_ID,
  status: 'IN_EXECUTION',
  ...overrides,
});

const baseProjectEntry = (month: number, overrides = {}) => ({
  id: `proj-entry-cuid-${month}`,
  projectId: PROJECT_ID,
  glAccountId: GL_ACCOUNT_ID,
  category: 'opex',
  year: 2026,
  month,
  valueCents: 0,
  isActual: false,
  isUserSet: false,
  ...overrides,
});

const pmRequester = { id: ASSIGNED_PM_ID, email: 'pm@test.com', name: 'PM', roles: [Role.ProjectManager] };
const otherRequester = { id: OTHER_USER_ID, email: 'other@test.com', name: 'Other', roles: [Role.ProjectManager] };

const mockPrismaBase = {
  demand: {
    findUniqueOrThrow: jest.fn(),
  },
  project: {
    findUniqueOrThrow: jest.fn(),
  },
  financialPlanEntry: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  projectFinancialPlanEntry: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  glAccount: {
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};
const mockPrisma: typeof mockPrismaBase & { $transaction: jest.Mock } = {
  ...mockPrismaBase,
  $transaction: jest.fn((fn: (tx: typeof mockPrismaBase) => unknown) => fn(mockPrismaBase)),
};

describe('FinancialPlansService', () => {
  let service: FinancialPlansService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FinancialPlansService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(FinancialPlansService);
  });

  describe('getByDemand()', () => {
    it('returns glAccounts and entries for the demand', async () => {
      const entries = [baseEntry(1), baseEntry(2)];
      mockPrisma.financialPlanEntry.findMany.mockResolvedValue(entries);
      mockPrisma.glAccount.findMany.mockResolvedValue(glAccounts);

      const result = await service.getByDemand(DEMAND_ID);
      expect(result.entries).toHaveLength(2);
      expect(result.glAccounts).toHaveLength(1);
    });

    it('maps glAccount.name → label in response', async () => {
      const entries = [baseEntry(1)];
      mockPrisma.financialPlanEntry.findMany.mockResolvedValue(entries);
      mockPrisma.glAccount.findMany.mockResolvedValue(glAccounts);

      const result = await service.getByDemand(DEMAND_ID);
      expect(result.glAccounts[0].label).toBe('IT Consultancy');
    });

    it('expands mixed-category account into two rows', async () => {
      const entries = [baseEntry(1)];
      mockPrisma.financialPlanEntry.findMany.mockResolvedValue(entries);
      mockPrisma.glAccount.findMany.mockResolvedValue([
        { id: GL_ACCOUNT_ID, categories: ['opex', 'capex'], name: 'Hardware', isActive: true },
      ]);

      const result = await service.getByDemand(DEMAND_ID);
      expect(result.glAccounts).toHaveLength(2);
      expect(result.glAccounts.map((r) => r.category).sort()).toEqual(['capex', 'opex']);
    });

    it('includes inactive accounts that have entries for this demand', async () => {
      const inactiveAccountId = 'gl-inactive-1';
      const entries = [baseEntry(1, { glAccountId: inactiveAccountId })];
      mockPrisma.financialPlanEntry.findMany.mockResolvedValue(entries);
      mockPrisma.glAccount.findMany.mockResolvedValue([
        { id: inactiveAccountId, categories: ['opex'], name: 'Old item', isActive: false },
      ]);

      const result = await service.getByDemand(DEMAND_ID);
      expect(result.glAccounts[0].isActive).toBe(false);
      expect(mockPrisma.glAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('patchCells() — actuals locked: rejects edit to isActual cell with 422', () => {
    it('throws UnprocessableEntityException when patching an isActual cell', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand());
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(
        baseEntry(1, { isActual: true }),
      );

      await expect(
        service.patchCells(DEMAND_ID, {
          entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 5000 }],
        }, requester),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('patchCells() — zero value allowed', () => {
    it('upserts with valueCents=0 (does not delete)', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand());
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.financialPlanEntry.upsert.mockResolvedValue(baseEntry(3, { valueCents: 0, isUserSet: true }));
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.patchCells(DEMAND_ID, {
        entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 3, year: 2026, valueCents: 0 }],
      }, requester);

      expect(mockPrisma.financialPlanEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ valueCents: 0, isUserSet: true }),
        }),
      );
    });
  });

  describe('patchCells() — isUserSet set on upsert', () => {
    it('sets isUserSet=true when patching a cell', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand());
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(baseEntry(3));
      mockPrisma.financialPlanEntry.upsert.mockResolvedValue(
        baseEntry(3, { valueCents: 5000, isUserSet: true }),
      );
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.patchCells(DEMAND_ID, {
        entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 3, year: 2026, valueCents: 5000 }],
      }, requester);

      expect(mockPrisma.financialPlanEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ isUserSet: true }),
        }),
      );
      expect(result[0].isUserSet).toBe(true);
    });
  });

  describe('patchCells() — atomicity: wraps in $transaction', () => {
    it('wraps upserts in a $transaction', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand());
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.financialPlanEntry.upsert.mockResolvedValue(baseEntry(1, { valueCents: 1000, isUserSet: true }));
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.patchCells(DEMAND_ID, {
        entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 1000 }],
      }, requester);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('patchCells() — audit log written last', () => {
    it('creates an audit log entry with FINANCIAL_PLAN_UPDATED eventType', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand());
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.financialPlanEntry.upsert.mockResolvedValue(baseEntry(1));
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.patchCells(DEMAND_ID, {
        entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 1000 }],
      }, requester);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'FINANCIAL_PLAN_UPDATED',
            entityId: DEMAND_ID,
            changedBy: REQUESTER_ID,
          }),
        }),
      );
    });
  });

  describe('patchCells() — ownership check for DemandRequester', () => {
    it('throws ForbiddenException when DemandRequester patches a demand they do not own', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(
        baseDemand({ originatorId: 'other-user-id' }),
      );

      await expect(
        service.patchCells(DEMAND_ID, {
          entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 1000 }],
        }, demandRequester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows DemandRequester to patch their own demand', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand({ originatorId: REQUESTER_ID }));
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.financialPlanEntry.upsert.mockResolvedValue(baseEntry(1, { valueCents: 1000, isUserSet: true }));
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(
        service.patchCells(DEMAND_ID, {
          entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 1000 }],
        }, demandRequester),
      ).resolves.toBeDefined();
    });
  });

  describe('patchCells() — cross-year support', () => {
    it('upserts entries for different years with correct year field', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand());
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.financialPlanEntry.upsert.mockImplementation(({ create }: { create: unknown }) =>
        Promise.resolve(create),
      );
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.patchCells(DEMAND_ID, {
        entries: [
          { glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 10, year: 2026, valueCents: 1000 },
          { glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1,  year: 2027, valueCents: 2000 },
        ],
      }, requester);

      expect(mockPrisma.financialPlanEntry.upsert).toHaveBeenCalledTimes(2);
      const calls = mockPrisma.financialPlanEntry.upsert.mock.calls;
      expect(calls[0][0].create.year).toBe(2026);
      expect(calls[0][0].create.month).toBe(10);
      expect(calls[1][0].create.year).toBe(2027);
      expect(calls[1][0].create.month).toBe(1);
    });
  });

  describe('patchCells() — category stored on entry', () => {
    it('includes category in create payload', async () => {
      mockPrisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand());
      mockPrisma.financialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.financialPlanEntry.upsert.mockResolvedValue(baseEntry(1, { category: 'capex' }));
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.patchCells(DEMAND_ID, {
        entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'capex', month: 1, year: 2026, valueCents: 5000 }],
      }, requester);

      expect(mockPrisma.financialPlanEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ category: 'capex' }),
        }),
      );
    });
  });

  describe('Story 6.9 — getByProject()', () => {
    it('returns glAccounts and entries for the project', async () => {
      const entries = [baseProjectEntry(1), baseProjectEntry(2)];
      mockPrisma.project.findUniqueOrThrow.mockResolvedValue(baseProject());
      mockPrisma.projectFinancialPlanEntry.findMany.mockResolvedValue(entries);
      mockPrisma.glAccount.findMany.mockResolvedValue(glAccounts);

      const result = await service.getByProject(PROJECT_ID);
      expect(result.entries).toHaveLength(2);
      expect(result.glAccounts).toHaveLength(1);
    });

    it('throws NotFoundException when project does not exist', async () => {
      const { PrismaClientKnownRequestError } = jest.requireActual('@prisma/client/runtime/library') as typeof import('@prisma/client/runtime/library');
      mockPrisma.project.findUniqueOrThrow.mockRejectedValue(
        new PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '6.0.0' }),
      );

      await expect(service.getByProject('nonexistent-id')).rejects.toThrow();
    });

    it('maps glAccount.name → label in response', async () => {
      mockPrisma.project.findUniqueOrThrow.mockResolvedValue(baseProject());
      mockPrisma.projectFinancialPlanEntry.findMany.mockResolvedValue([baseProjectEntry(1)]);
      mockPrisma.glAccount.findMany.mockResolvedValue(glAccounts);

      const result = await service.getByProject(PROJECT_ID);
      expect(result.glAccounts[0].label).toBe('IT Consultancy');
    });
  });

  describe('Story 6.9 — patchProjectCells()', () => {
    it('throws ForbiddenException when requester is not the assigned PM', async () => {
      mockPrisma.project.findUniqueOrThrow.mockResolvedValue(baseProject({ assignedPmId: ASSIGNED_PM_ID }));

      await expect(
        service.patchProjectCells(PROJECT_ID, {
          entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 5000 }],
        }, otherRequester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnprocessableEntityException when patching an isActual cell', async () => {
      mockPrisma.project.findUniqueOrThrow.mockResolvedValue(baseProject());
      mockPrisma.projectFinancialPlanEntry.findUnique.mockResolvedValue(
        baseProjectEntry(1, { isActual: true }),
      );

      await expect(
        service.patchProjectCells(PROJECT_ID, {
          entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 5000 }],
        }, pmRequester),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('upserts cells and writes audit log last with PROJECT_FINANCIAL_PLAN_UPDATED', async () => {
      mockPrisma.project.findUniqueOrThrow.mockResolvedValue(baseProject());
      mockPrisma.projectFinancialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.projectFinancialPlanEntry.upsert.mockResolvedValue(
        baseProjectEntry(1, { valueCents: 5000, isUserSet: true }),
      );
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.patchProjectCells(PROJECT_ID, {
        entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 5000 }],
      }, pmRequester);

      expect(mockPrisma.projectFinancialPlanEntry.upsert).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'PROJECT_FINANCIAL_PLAN_UPDATED',
            entityType: 'ProjectFinancialPlan',
            entityId: PROJECT_ID,
            changedBy: ASSIGNED_PM_ID,
          }),
        }),
      );
    });

    it('sets isUserSet=true on upserted cells', async () => {
      mockPrisma.project.findUniqueOrThrow.mockResolvedValue(baseProject());
      mockPrisma.projectFinancialPlanEntry.findUnique.mockResolvedValue(null);
      mockPrisma.projectFinancialPlanEntry.upsert.mockResolvedValue(
        baseProjectEntry(1, { valueCents: 5000, isUserSet: true }),
      );
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.patchProjectCells(PROJECT_ID, {
        entries: [{ glAccountId: GL_ACCOUNT_ID, category: 'opex', month: 1, year: 2026, valueCents: 5000 }],
      }, pmRequester);

      expect(mockPrisma.projectFinancialPlanEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ isUserSet: true }),
        }),
      );
    });
  });
});
