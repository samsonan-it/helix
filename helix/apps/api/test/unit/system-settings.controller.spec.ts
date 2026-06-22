import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { Test } from '@nestjs/testing';
import { SystemSettingsController } from '../../src/config/system-settings.controller';
import { SystemSettingsService } from '../../src/config/system-settings.service';
import { systemSettingsResponseSchema } from '@helix/shared';

const MOCK_SETTINGS = {
  spThresholdEurCents:   5_000_000,
  intakeWindowStart:     null,
  intakeWindowEnd:       null,
  budgetCycleStart:      null,
  budgetCycleEnd:        null,
  gxpItValidationDays:   30,
  gxpDocumentationDays:  14,
};

describe('SystemSettingsController', () => {
  let controller: SystemSettingsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SystemSettingsController],
      providers: [
        { provide: SystemSettingsService, useValue: { getSettings: jest.fn().mockResolvedValue(MOCK_SETTINGS) } },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get(SystemSettingsController);
  });

  describe('getSettings()', () => {
    it('returns a shape that matches SystemSettingsResponse schema', async () => {
      const result = await controller.getSettings({} as never);
      const parsed = systemSettingsResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('returns default GxP IT Validation of 30 days', async () => {
      const result = await controller.getSettings({} as never);
      expect(result.gxpItValidationDays).toBe(30);
    });

    it('returns default GxP Documentation of 14 days', async () => {
      const result = await controller.getSettings({} as never);
      expect(result.gxpDocumentationDays).toBe(14);
    });

    it('returns SP threshold euros cents', async () => {
      const result = await controller.getSettings({} as never);
      expect(result.spThresholdEurCents).toBe(5_000_000);
    });
  });
});
