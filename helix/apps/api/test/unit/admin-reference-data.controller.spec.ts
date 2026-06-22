import 'reflect-metadata';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AdminReferenceDataController } from '../../src/admin/admin-reference-data.controller';
import { AdminReferenceDataService } from '../../src/admin/admin-reference-data.service';
import { Role } from '@helix/types';
import { CostCentreAdminRow } from '@helix/shared';

const mockAdmin = { id: 'admin-1', email: 'admin@stada.dev', name: 'Helix Admin', roles: [Role.Admin] };
const mockNonAdmin = { id: 'user-1', email: 'user@stada.dev', name: 'Alice', roles: [Role.DemandRequester] };

const NOW = new Date('2026-06-03T00:00:00Z').toISOString();

const mockCcRow: CostCentreAdminRow = {
  id: 'cc-1',
  code: 'CC-001',
  name: 'IT Infrastructure',
  isActive: true,
  createdAt: NOW,
  updatedAt: null,
  updatedBy: null,
};

describe('AdminReferenceDataController', () => {
  let controller: AdminReferenceDataController;
  let refDataService: {
    listCostCentres: jest.Mock;
    createCostCentre: jest.Mock;
    updateCostCentre: jest.Mock;
    deactivateCostCentre: jest.Mock;
    activateCostCentre: jest.Mock;
    listGlAccounts: jest.Mock;
    createGlAccount: jest.Mock;
    updateGlAccount: jest.Mock;
    deactivateGlAccount: jest.Mock;
    activateGlAccount: jest.Mock;
    listLegalEntities: jest.Mock;
    createLegalEntity: jest.Mock;
    updateLegalEntity: jest.Mock;
    deactivateLegalEntity: jest.Mock;
    activateLegalEntity: jest.Mock;
    listAreas: jest.Mock;
    createArea: jest.Mock;
    updateArea: jest.Mock;
    deactivateArea: jest.Mock;
    activateArea: jest.Mock;
  };

  beforeEach(async () => {
    refDataService = {
      listCostCentres: jest.fn().mockResolvedValue([mockCcRow]),
      createCostCentre: jest.fn().mockResolvedValue(mockCcRow),
      updateCostCentre: jest.fn().mockResolvedValue(mockCcRow),
      deactivateCostCentre: jest.fn().mockResolvedValue(undefined),
      activateCostCentre: jest.fn().mockResolvedValue(undefined),
      listGlAccounts: jest.fn().mockResolvedValue([]),
      createGlAccount: jest.fn().mockResolvedValue({}),
      updateGlAccount: jest.fn().mockResolvedValue({}),
      deactivateGlAccount: jest.fn().mockResolvedValue(undefined),
      activateGlAccount: jest.fn().mockResolvedValue(undefined),
      listLegalEntities: jest.fn().mockResolvedValue([]),
      createLegalEntity: jest.fn().mockResolvedValue({}),
      updateLegalEntity: jest.fn().mockResolvedValue({}),
      deactivateLegalEntity: jest.fn().mockResolvedValue(undefined),
      activateLegalEntity: jest.fn().mockResolvedValue(undefined),
      listAreas: jest.fn().mockResolvedValue([]),
      createArea: jest.fn().mockResolvedValue({}),
      updateArea: jest.fn().mockResolvedValue({}),
      deactivateArea: jest.fn().mockResolvedValue(undefined),
      activateArea: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminReferenceDataController],
      providers: [
        { provide: AdminReferenceDataService, useValue: refDataService },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<AdminReferenceDataController>(AdminReferenceDataController);
  });

  // ── GET /admin/cost-centres ───────────────────────────────────────

  describe('GET /admin/cost-centres', () => {
    it('returns 200 with all cost centres for Admin', async () => {
      const result = await controller.listCostCentres();
      expect(result).toEqual([mockCcRow]);
    });

    it('RolesGuard rejects non-Admin with 403 (metadata check)', () => {
      const metadata = Reflect.getMetadata('roles', AdminReferenceDataController);
      expect(metadata).toContain(Role.Admin);
      expect(mockNonAdmin.roles.includes(Role.Admin)).toBe(false);
    });
  });

  // ── POST /admin/cost-centres ──────────────────────────────────────

  describe('POST /admin/cost-centres', () => {
    const dto = { code: 'CC-NEW', name: 'New Centre' };

    it('returns 201 created row for Admin with valid payload', async () => {
      const result = await controller.createCostCentre(dto, mockAdmin as never);
      expect(result).toEqual(mockCcRow);
      expect(refDataService.createCostCentre).toHaveBeenCalledWith(dto, mockAdmin.id);
    });

    it('propagates ConflictException (409) on duplicate code', async () => {
      refDataService.createCostCentre.mockRejectedValue(
        new ConflictException('An entry with this code already exists'),
      );
      await expect(controller.createCostCentre(dto, mockAdmin as never)).rejects.toThrow(ConflictException);
    });

    it('RolesGuard rejects non-Admin (metadata check)', () => {
      const metadata = Reflect.getMetadata('roles', AdminReferenceDataController);
      expect(metadata).toContain(Role.Admin);
      expect(mockNonAdmin.roles.includes(Role.Admin)).toBe(false);
    });
  });

  // ── PATCH /admin/cost-centres/:id ────────────────────────────────

  describe('PATCH /admin/cost-centres/:id', () => {
    it('returns updated row for Admin with valid payload', async () => {
      const dto = { name: 'Updated Name' };
      const result = await controller.updateCostCentre('cc-1', dto, mockAdmin as never);
      expect(result).toEqual(mockCcRow);
      expect(refDataService.updateCostCentre).toHaveBeenCalledWith('cc-1', dto, mockAdmin.id);
    });

    it('propagates NotFoundException (404) when id not found', async () => {
      refDataService.updateCostCentre.mockRejectedValue(new NotFoundException('Cost centre not found'));
      await expect(controller.updateCostCentre('bad-id', { name: 'x' }, mockAdmin as never))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── PATCH /admin/cost-centres/:id/deactivate ─────────────────────

  describe('PATCH /admin/cost-centres/:id/deactivate', () => {
    it('returns void when no blockers', async () => {
      const result = await controller.deactivateCostCentre('cc-1', mockAdmin as never);
      expect(result).toBeUndefined();
    });

    it('propagates UnprocessableEntityException (422) with blockers when in-flight demands exist', async () => {
      refDataService.deactivateCostCentre.mockRejectedValue(
        new UnprocessableEntityException({
          blockers: [{ id: 'd-1', title: 'Active Demand', status: 'IN_REVIEW' }],
        }),
      );
      await expect(controller.deactivateCostCentre('cc-1', mockAdmin as never)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ── PATCH /admin/cost-centres/:id/activate ───────────────────────

  describe('PATCH /admin/cost-centres/:id/activate', () => {
    it('returns void for Admin', async () => {
      const result = await controller.activateCostCentre('cc-1', mockAdmin as never);
      expect(result).toBeUndefined();
      expect(refDataService.activateCostCentre).toHaveBeenCalledWith('cc-1', mockAdmin.id);
    });
  });
});
