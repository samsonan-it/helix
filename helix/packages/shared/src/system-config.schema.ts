import { z } from 'zod';

export const SystemConfigKeys = {
  SP_THRESHOLD_EUR_CENTS:  'sp_threshold_eur_cents',
  INTAKE_WINDOW_START:     'intake_window_start',
  INTAKE_WINDOW_END:       'intake_window_end',
  BUDGET_CYCLE_START:      'budget_cycle_start',
  BUDGET_CYCLE_END:        'budget_cycle_end',
  GXP_IT_VALIDATION_DAYS:  'gxp_it_validation_days',
  GXP_DOCUMENTATION_DAYS:  'gxp_documentation_days',
} as const;
export type SystemConfigKey = typeof SystemConfigKeys[keyof typeof SystemConfigKeys];

// Admin PATCH body — partial update (send only changed keys)
export const updateSystemConfigSchema = z.object({
  spThresholdEurCents:   z.number().int().positive().optional(),
  intakeWindowStart:     z.string().datetime({ offset: true }).nullable().optional(),
  intakeWindowEnd:       z.string().datetime({ offset: true }).nullable().optional(),
  budgetCycleStart:      z.string().datetime({ offset: true }).nullable().optional(),
  budgetCycleEnd:        z.string().datetime({ offset: true }).nullable().optional(),
  gxpItValidationDays:   z.number().int().positive().optional(),
  gxpDocumentationDays:  z.number().int().positive().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'At least one field required' })
  .refine(
    obj => {
      if (!obj.intakeWindowStart || !obj.intakeWindowEnd) return true;
      return new Date(obj.intakeWindowStart) <= new Date(obj.intakeWindowEnd);
    },
    { message: 'intakeWindowStart must not be after intakeWindowEnd' },
  );
export type UpdateSystemConfigDto = z.infer<typeof updateSystemConfigSchema>;
