import { z } from 'zod';

export const VALID_PROJECT_TRANSITIONS: Record<string, string[]> = {
  DRAFT:               ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL:    ['IN_EXECUTION', 'DRAFT', 'CANCELLED'],
  IN_EXECUTION:        ['PREPARE_FOR_CLOSURE', 'ASSUMED_COMPLETED', 'CANCELLED'],
  ASSUMED_COMPLETED:   ['IN_EXECUTION', 'PREPARE_FOR_CLOSURE', 'CANCELLED'],
  PREPARE_FOR_CLOSURE: ['COMPLETED', 'IN_EXECUTION', 'CANCELLED'],
  COMPLETED:           [],
  CANCELLED:           [],
};

const nonEmptyStringOrNull = z.string().min(1).nullable().optional();

export const updateCharterSchema = z.object({
  objective:                    nonEmptyStringOrNull,
  necessity:                    nonEmptyStringOrNull,
  gxpRelevant:                  z.boolean().nullable().optional(),
  eaInvolved:                   z.boolean().nullable().optional(),
  eaComment:                    nonEmptyStringOrNull,
  itSecurityInvolved:           z.boolean().nullable().optional(),
  itSecurityComment:            nonEmptyStringOrNull,
  scope:                        nonEmptyStringOrNull,
  depsAssumptionsRisk:          nonEmptyStringOrNull,
  appPlatformOwner:             nonEmptyStringOrNull,
  businessPm:                   nonEmptyStringOrNull,
  businessSponsor:              nonEmptyStringOrNull,
  icRecharge:                   z.boolean().nullable().optional(),
  icRechargeAlignmentConducted: z.boolean().nullable().optional(),
  archImpact:                   nonEmptyStringOrNull,
  eaAlignmentConducted:         z.boolean().nullable().optional(),
  itSecurityAlignmentConducted: z.boolean().nullable().optional(),
  maintenanceL1:                nonEmptyStringOrNull,
  maintenanceL2:                nonEmptyStringOrNull,
  maintenanceL3:                nonEmptyStringOrNull,
  licensesNeeded:               z.boolean().nullable().optional(),
  licenseCostCents:             z.number().int().nonnegative().nullable().optional(),
  licenseExpectedUsers:         z.number().int().nonnegative().nullable().optional(),
  licenseMetric:                nonEmptyStringOrNull,
  licenseInBudget:              z.boolean().nullable().optional(),
  qualitativeValue:             z.boolean().nullable().optional(),
  quantitativeValue:            z.boolean().nullable().optional(),
  valueCaseDescription:         nonEmptyStringOrNull,
});

export type UpdateCharterDto = z.infer<typeof updateCharterSchema>;

export const closureSubmitSchema = z.object({
  workDelivered: z.literal(true),
  financialReconciled: z.literal(true),
  pmSummaryNotes: z.string().max(2000).optional(),
});

export type ClosureSubmitDto = z.infer<typeof closureSubmitSchema>;

export const projectPlanItemSchema = z.object({
  name:      z.string().min(1),
  type:      z.enum(['PHASE', 'MILESTONE']),
  startDate: z.string().datetime(),
  endDate:   z.string().datetime().nullable().optional(),
}).superRefine((item, ctx) => {
  if (item.type === 'PHASE') {
    if (!item.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Required for PHASE items' });
    } else if (new Date(item.endDate) < new Date(item.startDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must be ≥ start date' });
    }
  }
});

export const replaceProjectPlanSchema = z.object({
  items: z.array(projectPlanItemSchema).min(1).max(50),
});

export type ProjectPlanItemDto = z.infer<typeof projectPlanItemSchema>;
export type ReplaceProjectPlanDto = z.infer<typeof replaceProjectPlanSchema>;

export const submitCharterValidationSchema = updateCharterSchema.superRefine((data, ctx) => {
  const mandatoryStrings: (keyof typeof data)[] = [
    'objective', 'necessity',
    'scope', 'depsAssumptionsRisk', 'appPlatformOwner', 'businessPm',
    'businessSponsor', 'archImpact', 'maintenanceL1', 'maintenanceL2', 'maintenanceL3',
  ];
  for (const field of mandatoryStrings) {
    const val = data[field];
    if (typeof val === 'string' ? !val.trim() : val == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Required' });
    }
  }
  if (data.licensesNeeded === null || data.licensesNeeded === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['licensesNeeded'], message: 'Required' });
  }
  const mustBeTrue = ['eaAlignmentConducted', 'itSecurityAlignmentConducted'] as const;
  for (const field of mustBeTrue) {
    if (data[field] !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Must be Yes to submit' });
    }
  }
  if (data.icRecharge === true && data.icRechargeAlignmentConducted !== true) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['icRechargeAlignmentConducted'], message: 'Must be Yes to submit when IC Recharge is active' });
  }
  if (data.qualitativeValue === true || data.quantitativeValue === true) {
    if (!data.valueCaseDescription?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valueCaseDescription'], message: 'Required when a value category is selected' });
    }
  }
  if (data.licensesNeeded === true) {
    if (data.licenseCostCents === null || data.licenseCostCents === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['licenseCostCents'], message: 'Required when licenses needed' });
    }
    if (data.licenseExpectedUsers === null || data.licenseExpectedUsers === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['licenseExpectedUsers'], message: 'Required when licenses needed' });
    }
    if (!data.licenseMetric?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['licenseMetric'], message: 'Required when licenses needed' });
    }
    if (data.licenseInBudget === null || data.licenseInBudget === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['licenseInBudget'], message: 'Required when licenses needed' });
    }
  }
});

export const projectHistoryItemSchema = z.object({
  id:        z.string().cuid(),
  eventType: z.string(),
  changedBy: z.string(),
  actorName: z.string(),
  changedAt: z.string().datetime({ offset: true }),
  before:    z.unknown().nullable(),
  after:     z.unknown().nullable(),
});
export type ProjectHistoryItem = z.infer<typeof projectHistoryItemSchema>;
