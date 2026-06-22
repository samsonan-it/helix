import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigKeys } from '@helix/shared';

export interface SystemConfigValues {
  spThresholdEurCents:   number;
  intakeWindowStart:     string | null;
  intakeWindowEnd:       string | null;
  budgetCycleStart:      string | null;
  budgetCycleEnd:        string | null;
  gxpItValidationDays:   number;
  gxpDocumentationDays:  number;
}

const DEFAULTS: SystemConfigValues = {
  spThresholdEurCents:   5_000_000,
  intakeWindowStart:     null,
  intakeWindowEnd:       null,
  budgetCycleStart:      null,
  budgetCycleEnd:        null,
  gxpItValidationDays:   30,
  gxpDocumentationDays:  14,
};

@Injectable()
export class SystemConfigService {
  private cache: { value: SystemConfigValues; expiresAt: number } | null = null;
  private readonly TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<SystemConfigValues> {
    if (this.cache && Date.now() < this.cache.expiresAt) return this.cache.value;
    const rows = await this.prisma.systemConfig.findMany();
    const value = this.parse(rows);
    this.cache = { value, expiresAt: Date.now() + this.TTL_MS };
    return value;
  }

  invalidateCache(): void { this.cache = null; }

  private parse(rows: { key: string; value: string }[]): SystemConfigValues {
    const map = new Map(rows.map(r => [r.key, r.value]));
    const num = (k: string, d: number): number => { const v = map.get(k); if (v == null) return d; const n = parseInt(v, 10); return isNaN(n) ? d : n; };
    const str = (k: string, d: string | null): string | null => { const v = map.get(k); return (v == null || v === 'null') ? d : v; };
    return {
      spThresholdEurCents:   num(SystemConfigKeys.SP_THRESHOLD_EUR_CENTS,  DEFAULTS.spThresholdEurCents),
      intakeWindowStart:     str(SystemConfigKeys.INTAKE_WINDOW_START,     DEFAULTS.intakeWindowStart),
      intakeWindowEnd:       str(SystemConfigKeys.INTAKE_WINDOW_END,       DEFAULTS.intakeWindowEnd),
      budgetCycleStart:      str(SystemConfigKeys.BUDGET_CYCLE_START,      DEFAULTS.budgetCycleStart),
      budgetCycleEnd:        str(SystemConfigKeys.BUDGET_CYCLE_END,        DEFAULTS.budgetCycleEnd),
      gxpItValidationDays:   num(SystemConfigKeys.GXP_IT_VALIDATION_DAYS,  DEFAULTS.gxpItValidationDays),
      gxpDocumentationDays:  num(SystemConfigKeys.GXP_DOCUMENTATION_DAYS,  DEFAULTS.gxpDocumentationDays),
    };
  }
}
