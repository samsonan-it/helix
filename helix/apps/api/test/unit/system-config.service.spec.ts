import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigService } from '../../src/config/system-config.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let prisma: { systemConfig: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
  });

  afterEach(() => {
    // Reset cache between tests
    service.invalidateCache();
  });

  it('returns defaults when DB returns no rows', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([]);
    const result = await service.getAll();
    expect(result.spThresholdEurCents).toBe(5_000_000);
    expect(result.gxpItValidationDays).toBe(30);
    expect(result.gxpDocumentationDays).toBe(14);
    expect(result.intakeWindowStart).toBeNull();
    expect(result.intakeWindowEnd).toBeNull();
  });

  it('correctly parses integer key sp_threshold_eur_cents', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([
      { key: 'sp_threshold_eur_cents', value: '10000000' },
    ]);
    const result = await service.getAll();
    expect(result.spThresholdEurCents).toBe(10_000_000);
  });

  it('correctly parses integer keys gxp_it_validation_days and gxp_documentation_days', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([
      { key: 'gxp_it_validation_days',  value: '45' },
      { key: 'gxp_documentation_days',  value: '21' },
    ]);
    const result = await service.getAll();
    expect(result.gxpItValidationDays).toBe(45);
    expect(result.gxpDocumentationDays).toBe(21);
  });

  it('correctly parses string "null" as null for date keys', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([
      { key: 'intake_window_start', value: 'null' },
      { key: 'intake_window_end',   value: 'null' },
    ]);
    const result = await service.getAll();
    expect(result.intakeWindowStart).toBeNull();
    expect(result.intakeWindowEnd).toBeNull();
  });

  it('returns actual ISO date string when set', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([
      { key: 'intake_window_start', value: '2026-06-01T00:00:00.000Z' },
    ]);
    const result = await service.getAll();
    expect(result.intakeWindowStart).toBe('2026-06-01T00:00:00.000Z');
  });

  it('returns cached value on second call within TTL (DB not queried twice)', async () => {
    await service.getAll();
    await service.getAll();
    expect(prisma.systemConfig.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache() causes next getAll() to re-query DB', async () => {
    await service.getAll();
    service.invalidateCache();
    await service.getAll();
    expect(prisma.systemConfig.findMany).toHaveBeenCalledTimes(2);
  });

  it('GxP defaults test (NFR14): changing gxp_it_validation_days to 45 is reflected in getAll()', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([
      { key: 'gxp_it_validation_days', value: '45' },
    ]);
    const result = await service.getAll();
    expect(result.gxpItValidationDays).toBe(45);
  });
});
