import { z } from 'zod';

export const systemSettingsResponseSchema = z.object({
  spThresholdEurCents:   z.number().int().positive(),
  intakeWindowStart:     z.string().datetime({ offset: true }).nullable(),
  intakeWindowEnd:       z.string().datetime({ offset: true }).nullable(),
  budgetCycleStart:      z.string().datetime({ offset: true }).nullable(),
  budgetCycleEnd:        z.string().datetime({ offset: true }).nullable(),
  gxpItValidationDays:   z.number().int().positive(),
  gxpDocumentationDays:  z.number().int().positive(),
});
export type SystemSettingsResponse = z.infer<typeof systemSettingsResponseSchema>;
