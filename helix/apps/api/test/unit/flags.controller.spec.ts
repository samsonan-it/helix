import 'reflect-metadata';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { FlagsController } from '../../src/config/flags.controller';
import { FlagService } from '../../src/config/flag.service';
import { FlagKeys } from '../../src/config/flag-keys';

describe('FlagsController', () => {
  let controller: FlagsController;
  let flagService: { get: jest.Mock };

  beforeEach(async () => {
    flagService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlagsController],
      providers: [{ provide: FlagService, useValue: flagService }],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<FlagsController>(FlagsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns all flag keys with correct values', async () => {
    flagService.get.mockImplementation((key: string) => {
      if (key === FlagKeys.AI_PREFILL) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const result = await controller.getAll();

    expect(result[FlagKeys.AI_PREFILL]).toBe(true);
  });

  it('returns all FlagKeys keys in the response', async () => {
    flagService.get.mockResolvedValue(false);

    const result = await controller.getAll();
    const resultKeys = Object.keys(result);

    for (const key of Object.values(FlagKeys)) {
      expect(resultKeys).toContain(key);
    }
  });
});
