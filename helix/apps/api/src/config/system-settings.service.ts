import { Injectable } from '@nestjs/common';
import { SystemSettingsResponse } from '@helix/shared';
import { SystemConfigService } from './system-config.service';

@Injectable()
export class SystemSettingsService {
  constructor(private readonly systemConfig: SystemConfigService) {}

  async getSettings(): Promise<SystemSettingsResponse> {
    const cfg = await this.systemConfig.getAll();
    return {
      spThresholdEurCents:   cfg.spThresholdEurCents,
      intakeWindowStart:     cfg.intakeWindowStart,
      intakeWindowEnd:       cfg.intakeWindowEnd,
      budgetCycleStart:      cfg.budgetCycleStart,
      budgetCycleEnd:        cfg.budgetCycleEnd,
      gxpItValidationDays:   cfg.gxpItValidationDays,
      gxpDocumentationDays:  cfg.gxpDocumentationDays,
    };
  }
}
