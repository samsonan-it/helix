import 'reflect-metadata';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminFeatureFlagsController } from '../../src/admin/admin-feature-flags.controller';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@helix/types';
import { FlagKeys } from '../../src/config/flag-keys';

const mockAdmin = { id: 'admin-1', email: 'admin@stada.dev', name: 'Helix Admin', roles: [Role.Admin] };
const mockNonAdmin = { id: 'user-1', email: 'user@stada.dev', name: 'Alice', roles: [Role.DemandRequester] };

const NOW = new Date('2026-06-03T00:00:00Z');

const flagRows = [
  { key: FlagKeys.AI_PREFILL, value: false, description: null, updatedAt: NOW, updatedBy: null },
];

describe('AdminFeatureFlagsController', () => {
  let controller: AdminFeatureFlagsController;
  let mockTx: {
    config: { findUnique: jest.Mock; upsert: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let prisma: {
    config: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock };
    user: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockTx = {
      config: {
        findUnique: jest.fn().mockResolvedValue(flagRows[0]),
        upsert: jest.fn().mockResolvedValue({ ...flagRows[0], value: true, updatedBy: 'admin-1' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      config: {
        findMany: jest.fn().mockResolvedValue(flagRows),
        findUnique: jest.fn().mockResolvedValue(flagRows[0]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((fn) => fn(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFeatureFlagsController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<AdminFeatureFlagsController>(AdminFeatureFlagsController);
  });

  // ── GET /admin/feature-flags ─────────────────────────────────────

  describe('GET /admin/feature-flags', () => {
    it('returns all 1 flag with value, updatedAt, updatedByName', async () => {
      const result = await controller.listFlags(mockAdmin as never);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        key: FlagKeys.AI_PREFILL,
        value: false,
        updatedByName: null,
      });
      expect(result[0].updatedAt).toBe(NOW.toISOString());
    });

    it('returns updatedByName: null when updatedBy is null on the config row', async () => {
      prisma.config.findMany.mockResolvedValue([
        { ...flagRows[0], updatedBy: null },
      ]);
      const result = await controller.listFlags(mockAdmin as never);
      expect(result[0].updatedByName).toBeNull();
    });

    it('resolves updatedByName from user.name when updatedBy is a valid user ID', async () => {
      prisma.config.findMany.mockResolvedValue([
        { ...flagRows[0], updatedBy: 'admin-1' },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1', name: 'Helix Admin' }]);
      const result = await controller.listFlags(mockAdmin as never);
      expect(result[0].updatedByName).toBe('Helix Admin');
    });

    it('RolesGuard rejects non-Admin (metadata check)', () => {
      const metadata = Reflect.getMetadata('roles', AdminFeatureFlagsController);
      expect(metadata).toContain(Role.Admin);
      expect(mockNonAdmin.roles.includes(Role.Admin)).toBe(false);
    });
  });

  // ── PATCH /admin/feature-flags/:key ──────────────────────────────

  describe('PATCH /admin/feature-flags/:key', () => {
    it('calls tx.config.upsert with correct data', async () => {
      mockTx.config.findUnique.mockResolvedValue({ ...flagRows[0], value: false });
      await controller.toggleFlag(FlagKeys.AI_PREFILL, { value: true }, mockAdmin as never);
      expect(mockTx.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: FlagKeys.AI_PREFILL },
          update: { value: true, updatedBy: mockAdmin.id },
          create: { key: FlagKeys.AI_PREFILL, value: true, updatedBy: mockAdmin.id },
        }),
      );
    });

    it('audit log entry has correct entityType, entityId, eventType, changedBy', async () => {
      mockTx.config.findUnique.mockResolvedValue({ ...flagRows[0], value: false });
      await controller.toggleFlag(FlagKeys.AI_PREFILL, { value: true }, mockAdmin as never);
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'FeatureFlag',
            entityId: FlagKeys.AI_PREFILL,
            eventType: 'FLAG_TOGGLED',
            changedBy: mockAdmin.id,
          }),
        }),
      );
    });

    it('auditLog.create is called AFTER config.upsert in the transaction', async () => {
      mockTx.config.findUnique.mockResolvedValue({ ...flagRows[0], value: false });
      const callOrder: string[] = [];
      mockTx.config.upsert.mockImplementation(async () => { callOrder.push('upsert'); return { ...flagRows[0], value: true, updatedBy: 'admin-1' }; });
      mockTx.auditLog.create.mockImplementation(async () => { callOrder.push('auditLog'); });

      await controller.toggleFlag(FlagKeys.AI_PREFILL, { value: true }, mockAdmin as never);
      expect(callOrder).toEqual(['upsert', 'auditLog']);
    });

    it('throws NotFoundException for unknown flag key', async () => {
      await expect(
        controller.toggleFlag('unknown_key', { value: true }, mockAdmin as never),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
