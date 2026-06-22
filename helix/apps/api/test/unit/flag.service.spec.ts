import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FlagService } from '../../src/config/flag.service';
import { FlagKeys } from '../../src/config/flag-keys';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('FlagService', () => {
  let service: FlagService;
  let prisma: { config: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      config: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlagService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FlagService>(FlagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns false for ai_prefill flag seeded as false', async () => {
    prisma.config.findUnique.mockResolvedValue({ key: FlagKeys.AI_PREFILL, value: false });
    const result = await service.get(FlagKeys.AI_PREFILL);
    expect(result).toBe(false);
    expect(prisma.config.findUnique).toHaveBeenCalledWith({ where: { key: FlagKeys.AI_PREFILL } });
  });

  it('returns true when a flag is enabled', async () => {
    prisma.config.findUnique.mockResolvedValue({ key: FlagKeys.AI_PREFILL, value: true });
    const result = await service.get(FlagKeys.AI_PREFILL);
    expect(result).toBe(true);
  });

  it('returns false (safe default) when flag key not found in Config table', async () => {
    prisma.config.findUnique.mockResolvedValue(null);
    const result = await service.get(FlagKeys.AI_PREFILL);
    expect(result).toBe(false);
  });
});
