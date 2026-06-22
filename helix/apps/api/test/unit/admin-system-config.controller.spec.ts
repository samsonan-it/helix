import 'reflect-metadata';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminSystemConfigController } from '../../src/admin/admin-system-config.controller';
import { SystemConfigService } from '../../src/config/system-config.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@helix/types';

const mockAdmin = { id: 'admin-1', email: 'admin@stada.dev', name: 'Admin', roles: [Role.Admin] };

const DEFAULT_CONFIG = {
  spThresholdEurCents:   5_000_000,
  intakeWindowStart:     null,
  intakeWindowEnd:       null,
  budgetCycleStart:      null,
  budgetCycleEnd:        null,
  gxpItValidationDays:   30,
  gxpDocumentationDays:  14,
};

describe('AdminSystemConfigController', () => {
  let controller: AdminSystemConfigController;
  let systemConfig: { getAll: jest.Mock; invalidateCache: jest.Mock };
  let prisma: {
    $transaction: jest.Mock;
    systemConfig: { findUnique: jest.Mock; upsert: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    systemConfig = {
      getAll: jest.fn().mockResolvedValue(DEFAULT_CONFIG),
      invalidateCache: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue({ value: '5000000' }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSystemConfigController],
      providers: [
        { provide: SystemConfigService, useValue: systemConfig },
        { provide: PrismaService, useValue: prisma },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<AdminSystemConfigController>(AdminSystemConfigController);
  });

  describe('GET /admin/system-config', () => {
    it('returns current system config for Admin', async () => {
      const result = await controller.getConfig(mockAdmin);
      expect(result).toEqual(DEFAULT_CONFIG);
      expect(systemConfig.getAll).toHaveBeenCalled();
    });
  });

  describe('PATCH /admin/system-config', () => {
    it('returns 200 for Admin with valid partial payload', async () => {
      const result = await controller.updateConfig({ spThresholdEurCents: 10_000_000 }, mockAdmin);
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('writes one audit log entry per changed key', async () => {
      await controller.updateConfig({ spThresholdEurCents: 10_000_000, gxpItValidationDays: 45 }, mockAdmin);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    });

    it('calls systemConfig.invalidateCache() after transaction', async () => {
      await controller.updateConfig({ spThresholdEurCents: 10_000_000 }, mockAdmin);
      expect(systemConfig.invalidateCache).toHaveBeenCalled();
    });

    it('throws BadRequestException on empty body (Zod refine)', () => {
      // The ZodValidationPipe will reject an empty object via the refine() rule
      // In unit test we test the Zod schema directly
      const { updateSystemConfigSchema } = require('@helix/shared');
      const result = updateSystemConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('upserts the correct key with the serialized value', async () => {
      await controller.updateConfig({ gxpItValidationDays: 60 }, mockAdmin);
      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'gxp_it_validation_days' },
          update: expect.objectContaining({ value: '60', updatedBy: mockAdmin.id }),
        }),
      );
    });
  });
});
