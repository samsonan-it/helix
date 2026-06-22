import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminReferenceDataService } from '../../src/admin/admin-reference-data.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const ADMIN_ID = 'admin-cuid-1';
const CC_ID   = 'cc-cuid-1';
const GL_ID   = 'gl-cuid-1';
const NOW     = new Date('2026-06-03T00:00:00Z');

const makeCc = (overrides = {}) => ({
  id: CC_ID,
  code: 'CC-001',
  name: 'IT Infrastructure',
  isActive: true,
  createdAt: NOW,
  updatedAt: null,
  updatedBy: null,
  ...overrides,
});

const makeGl = (overrides = {}) => ({
  id: GL_ID,
  code: '6300',
  name: 'Software Licenses',
  description: null,
  categories: ['capex'] as ('capex' | 'benefits' | 'opex')[],
  isActive: true,
  createdAt: NOW,
  updatedAt: null,
  updatedBy: null,
  ...overrides,
});

describe('AdminReferenceDataService', () => {
  let service: AdminReferenceDataService;
  let prisma: {
    $transaction: jest.Mock;
    costCentre: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    glAccount: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    demand: {
      findMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
      costCentre: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(makeCc()),
        create: jest.fn().mockResolvedValue(makeCc()),
        update: jest.fn().mockResolvedValue(makeCc()),
      },
      glAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(makeGl()),
        create: jest.fn().mockResolvedValue(makeGl()),
        update: jest.fn().mockResolvedValue(makeGl()),
      },
      demand: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminReferenceDataService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminReferenceDataService>(AdminReferenceDataService);
  });

  // ── listCostCentres ───────────────────────────────────────────────

  describe('listCostCentres', () => {
    it('returns all entries including inactive, ordered active-first then by code', async () => {
      const rows = [
        makeCc({ id: 'cc-1', code: 'CC-001', isActive: true }),
        makeCc({ id: 'cc-2', code: 'CC-002', isActive: false }),
      ];
      prisma.costCentre.findMany.mockResolvedValue(rows);

      const result = await service.listCostCentres();

      expect(result).toHaveLength(2);
      expect(prisma.costCentre.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
        }),
      );
    });

    it('maps ISO 8601 strings for createdAt and null for updatedAt', async () => {
      prisma.costCentre.findMany.mockResolvedValue([makeCc()]);
      const [row] = await service.listCostCentres();
      expect(row.createdAt).toBe(NOW.toISOString());
      expect(row.updatedAt).toBeNull();
    });
  });

  // ── createCostCentre ─────────────────────────────────────────────

  describe('createCostCentre', () => {
    const dto = { code: 'CC-NEW', name: 'New Centre' };

    it('creates record + audit log in one transaction; returns mapped row', async () => {
      prisma.costCentre.findUnique.mockResolvedValue(null);
      const callOrder: string[] = [];
      prisma.costCentre.create.mockImplementation(async () => {
        callOrder.push('create');
        return makeCc({ code: dto.code, name: dto.name });
      });
      prisma.auditLog.create.mockImplementation(async () => {
        callOrder.push('auditLog');
        return {};
      });

      const result = await service.createCostCentre(dto, ADMIN_ID);

      expect(callOrder).toEqual(['create', 'auditLog']);
      expect(result).toMatchObject({ code: dto.code, name: dto.name });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'CostCentre',
            eventType: 'COST_CENTRE_CREATED',
            changedBy: ADMIN_ID,
            before: null,
          }),
        }),
      );
    });

    it('throws ConflictException on duplicate code without entering transaction', async () => {
      prisma.costCentre.findUnique.mockResolvedValue(makeCc());
      await expect(service.createCostCentre(dto, ADMIN_ID)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── updateCostCentre ─────────────────────────────────────────────

  describe('updateCostCentre', () => {
    it('updates record + audit log; updatedBy set to adminId', async () => {
      const updatedCc = makeCc({ code: 'CC-UPD', name: 'Updated', updatedBy: ADMIN_ID });
      prisma.costCentre.update.mockResolvedValue(updatedCc);

      const callOrder: string[] = [];
      prisma.costCentre.update.mockImplementation(async () => {
        callOrder.push('update');
        return updatedCc;
      });
      prisma.auditLog.create.mockImplementation(async () => {
        callOrder.push('auditLog');
        return {};
      });

      const result = await service.updateCostCentre(CC_ID, { name: 'Updated' }, ADMIN_ID);

      expect(callOrder).toEqual(['update', 'auditLog']);
      expect(prisma.costCentre.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ updatedBy: ADMIN_ID }),
        }),
      );
      expect(result.updatedBy).toBe(ADMIN_ID);
    });

    it('throws NotFoundException if id not found', async () => {
      prisma.costCentre.findUnique.mockResolvedValue(null);
      await expect(service.updateCostCentre(CC_ID, { name: 'x' }, ADMIN_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException if new code collides with another entry', async () => {
      prisma.costCentre.findUnique
        .mockResolvedValueOnce(makeCc({ code: 'CC-001' }))
        .mockResolvedValueOnce(makeCc({ id: 'other-id', code: 'CC-002' }));

      await expect(service.updateCostCentre(CC_ID, { code: 'CC-002' }, ADMIN_ID)).rejects.toThrow(ConflictException);
    });
  });

  // ── deactivateCostCentre ─────────────────────────────────────────

  describe('deactivateCostCentre', () => {
    it('throws UnprocessableEntityException with blockers when in-flight demands exist', async () => {
      prisma.demand.findMany.mockResolvedValue([
        { id: 'd-1', title: 'Demand 1', status: 'IN_REVIEW' },
      ]);

      await expect(service.deactivateCostCentre(CC_ID, ADMIN_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sets isActive false + audit log when no blockers', async () => {
      prisma.demand.findMany.mockResolvedValue([]);
      const callOrder: string[] = [];
      prisma.costCentre.update.mockImplementation(async () => {
        callOrder.push('update');
        return makeCc({ isActive: false });
      });
      prisma.auditLog.create.mockImplementation(async () => {
        callOrder.push('auditLog');
        return {};
      });

      await service.deactivateCostCentre(CC_ID, ADMIN_ID);

      expect(callOrder).toEqual(['update', 'auditLog']);
      expect(prisma.costCentre.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, updatedBy: ADMIN_ID }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'COST_CENTRE_DEACTIVATED' }),
        }),
      );
    });
  });

  // ── activateCostCentre ───────────────────────────────────────────

  describe('activateCostCentre', () => {
    it('sets isActive true + writes COST_CENTRE_ACTIVATED audit log', async () => {
      prisma.costCentre.findUnique.mockResolvedValue(makeCc({ isActive: false }));
      const callOrder: string[] = [];
      prisma.costCentre.update.mockImplementation(async () => {
        callOrder.push('update');
        return makeCc({ isActive: true });
      });
      prisma.auditLog.create.mockImplementation(async () => {
        callOrder.push('auditLog');
        return {};
      });

      await service.activateCostCentre(CC_ID, ADMIN_ID);

      expect(callOrder).toEqual(['update', 'auditLog']);
      expect(prisma.costCentre.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true, updatedBy: ADMIN_ID }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'COST_CENTRE_ACTIVATED' }),
        }),
      );
    });

    it('throws NotFoundException if id not found', async () => {
      prisma.costCentre.findUnique.mockResolvedValue(null);
      await expect(service.activateCostCentre(CC_ID, ADMIN_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── GlAccount — pattern consistency ──────────────────────────────

  describe('createGlAccount (pattern consistency)', () => {
    const dto = { code: '9999', name: 'Test GL', categories: ['capex'] as ('capex' | 'benefits' | 'opex')[] };

    it('creates GL account + audit log; audit log last; categories included in after payload', async () => {
      prisma.glAccount.findUnique.mockResolvedValue(null);
      const callOrder: string[] = [];
      prisma.glAccount.create.mockImplementation(async () => {
        callOrder.push('create');
        return makeGl({ code: dto.code, name: dto.name, categories: dto.categories });
      });
      prisma.auditLog.create.mockImplementation(async () => {
        callOrder.push('auditLog');
        return {};
      });

      await service.createGlAccount(dto, ADMIN_ID);

      expect(callOrder).toEqual(['create', 'auditLog']);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'GlAccount',
            eventType: 'GL_ACCOUNT_CREATED',
            changedBy: ADMIN_ID,
            after: expect.objectContaining({ categories: ['capex'] }),
          }),
        }),
      );
    });

    it('throws ConflictException on duplicate GL code', async () => {
      prisma.glAccount.findUnique.mockResolvedValue(makeGl());
      await expect(service.createGlAccount(dto, ADMIN_ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivateGlAccount (pattern consistency)', () => {
    it('blocks deactivation when in-flight demands reference GL account', async () => {
      prisma.demand.findMany.mockResolvedValue([{ id: 'd-1', title: 'D1', status: 'SUBMITTED' }]);
      await expect(service.deactivateGlAccount(GL_ID, ADMIN_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
