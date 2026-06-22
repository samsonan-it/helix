import { z } from 'zod';

export enum DemandStatus {
  DRAFT           = 'DRAFT',
  SUBMITTED       = 'SUBMITTED',
  SP_OFFER_REVIEW = 'SP_OFFER_REVIEW',
  IN_REVIEW       = 'IN_REVIEW',
  BC_REVIEW       = 'BC_REVIEW',
  APPROVED        = 'APPROVED',
  REJECTED        = 'REJECTED',
  REROUTED        = 'REROUTED',
  ON_HOLD         = 'ON_HOLD',
  IN_EXECUTION    = 'IN_EXECUTION',
  COMPLETED       = 'COMPLETED',
  CANCELLED       = 'CANCELLED',
}

// Authoritative transition table — any transition not listed here is forbidden.
// demand-workflow.service.ts is the ONLY code permitted to call state transitions.
// ⚠️ Verify exact transition edges against PRD state machine before sprint start. PRD wins on conflict.
export const VALID_TRANSITIONS: Record<DemandStatus, DemandStatus[]> = {
  [DemandStatus.DRAFT]:           [DemandStatus.SUBMITTED, DemandStatus.CANCELLED],
  [DemandStatus.SUBMITTED]:       [DemandStatus.IN_REVIEW, DemandStatus.BC_REVIEW, DemandStatus.SP_OFFER_REVIEW, DemandStatus.REROUTED, DemandStatus.REJECTED, DemandStatus.ON_HOLD, DemandStatus.CANCELLED],
  [DemandStatus.BC_REVIEW]:       [DemandStatus.IN_REVIEW, DemandStatus.SP_OFFER_REVIEW, DemandStatus.REROUTED, DemandStatus.REJECTED, DemandStatus.SUBMITTED],
  [DemandStatus.SP_OFFER_REVIEW]: [DemandStatus.IN_REVIEW, DemandStatus.REROUTED, DemandStatus.CANCELLED],
  [DemandStatus.IN_REVIEW]:       [DemandStatus.APPROVED, DemandStatus.REJECTED, DemandStatus.REROUTED, DemandStatus.SUBMITTED],
  [DemandStatus.REJECTED]:        [DemandStatus.DRAFT, DemandStatus.CANCELLED],
  [DemandStatus.REROUTED]:        [DemandStatus.SUBMITTED, DemandStatus.SP_OFFER_REVIEW, DemandStatus.IN_REVIEW, DemandStatus.CANCELLED],
  [DemandStatus.ON_HOLD]:         [DemandStatus.SUBMITTED, DemandStatus.CANCELLED],
  [DemandStatus.APPROVED]:        [DemandStatus.IN_EXECUTION, DemandStatus.CANCELLED],
  [DemandStatus.IN_EXECUTION]:    [DemandStatus.COMPLETED, DemandStatus.CANCELLED],
  [DemandStatus.COMPLETED]:       [],
  [DemandStatus.CANCELLED]:       [],
};

// Accepts full ISO 8601 with offset ("2026-07-01T00:00:00.000Z") or bare calendar date ("2026-07-01").
// Bare dates are validated for calendar correctness via round-trip — rejects "2026-02-31" etc.
const isoDateString = z.string().datetime({ offset: true }).or(
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    s => { const d = new Date(s); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; },
    { message: 'Invalid date' },
  )
);

const dateRangeCheck = (d: { startDate?: string | null; endDate?: string | null }) => {
  if (!d.startDate || !d.endDate) return true;
  return new Date(d.endDate) >= new Date(d.startDate);
};
const dateRangeError = { message: 'End date cannot be before start date', path: ['endDate'] };

export const createDemandSchema = z.object({
  title:                     z.string().min(1).max(200),
  description:               z.string().min(1),
  costCentreId:              z.string().cuid().nullable().optional(),
  glAccountId:               z.string().cuid().nullable().optional(),
  startDate:                 isoDateString.nullable().optional(),
  endDate:                   isoDateString.nullable().optional(),
  legalEntityId:             z.string().cuid().nullable().optional(),
  areaId:                    z.string().cuid().nullable().optional(),
  demandManagerId:           z.string().cuid().nullable().optional(),
  demandOwner:               z.string().max(200).nullable().optional(),
  objective:                 z.string().max(2000).nullable().optional(),
  necessity:                 z.string().max(2000).nullable().optional(),
  isMandatory:               z.boolean().optional(),
  qualitativeValueCategory:  z.boolean().nullable().optional(),
  quantitativeValueCategory: z.boolean().nullable().optional(),
  reasoningForMandatory:     z.string().max(5000).nullable().optional(),
  asisDescription:           z.string().max(5000).nullable().optional(),
  benefitsObjectives:        z.string().max(5000).nullable().optional(),
  tobeDescription:           z.string().max(5000).nullable().optional(),
  isSmallProject:            z.boolean().optional(),
  isGxpRelevant:             z.boolean().optional(),
  businessControllerId:      z.string().cuid().nullable().optional(),
}).refine(dateRangeCheck, dateRangeError);

export type CreateDemandDto = z.infer<typeof createDemandSchema>;

// All fields optional — used for PATCH draft endpoint
export const updateDraftDemandSchema = z.object({
  title:                     z.string().min(1).max(200).optional(),
  description:               z.string().min(1).optional(),
  costCentreId:              z.string().cuid().nullable().optional(),
  glAccountId:               z.string().cuid().nullable().optional(),
  startDate:                 isoDateString.nullable().optional(),
  endDate:                   isoDateString.nullable().optional(),
  legalEntityId:             z.string().cuid().nullable().optional(),
  areaId:                    z.string().cuid().nullable().optional(),
  demandManagerId:           z.string().cuid().nullable().optional(),
  demandOwner:               z.string().max(200).nullable().optional(),
  objective:                 z.string().max(2000).nullable().optional(),
  necessity:                 z.string().max(2000).nullable().optional(),
  isMandatory:               z.boolean().optional(),
  qualitativeValueCategory:  z.boolean().nullable().optional(),
  quantitativeValueCategory: z.boolean().nullable().optional(),
  reasoningForMandatory:     z.string().max(5000).nullable().optional(),
  asisDescription:           z.string().max(5000).nullable().optional(),
  benefitsObjectives:        z.string().max(5000).nullable().optional(),
  tobeDescription:           z.string().max(5000).nullable().optional(),
  isSmallProject:            z.boolean().optional(),
  isGxpRelevant:             z.boolean().optional(),
  businessControllerId:      z.string().cuid().nullable().optional(),
  demandScope:               z.enum(['GLOBAL', 'LOCAL']).nullable().optional(),
  countryId:                 z.string().cuid().nullable().optional(),
}).refine(dateRangeCheck, dateRangeError);

export type UpdateDraftDemandDto = z.infer<typeof updateDraftDemandSchema>;

// Step-level schemas for frontend validation (not used server-side)
export const step1Schema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
});

export const step2Schema = z.object({
  costCentreId:    z.string().cuid('Please select a cost centre'),
  startDate:       isoDateString.nullable().optional(),
  endDate:         isoDateString.nullable().optional(),
  legalEntityId:   z.string().cuid().optional(),
  areaId:          z.string().cuid().optional(),
  demandManagerId: z.string().cuid().optional(),
}).refine(
  (d) => {
    if (!d.startDate || !d.endDate) return true;
    return new Date(d.endDate) >= new Date(d.startDate);
  },
  { message: 'End date cannot be before start date', path: ['endDate'] },
);

// Step 3 — Objectives step: all fields optional, advance always permitted
export const step3Schema = z.object({
  objective:                 z.string().max(2000).optional(),
  necessity:                 z.string().max(2000).optional(),
  isMandatory:               z.boolean().optional(),
  qualitativeValueCategory:  z.boolean().optional(),
  quantitativeValueCategory: z.boolean().optional(),
  reasoningForMandatory:     z.string().optional(),
  asisDescription:           z.string().max(5000).optional(),
  benefitsObjectives:        z.string().max(5000).optional(),
  tobeDescription:           z.string().max(5000).optional(),
});

// Form-layer schema — uses YYYY-MM-DD strings to match Mantine v8 DateInput.onChange value type.
// Business rules (min lengths, date range) mirror createDemandSchema so they stay in one source.
export const demandFormSchema = z.object({
  title:                     z.string().min(1, 'Title is required').max(200),
  description:               z.string().min(1, 'Description is required'),
  costCentreId:              z.string().min(1, 'Please select a cost centre'),
  demandType:                z.string().optional(),
  startDate:                 isoDateString.nullable().optional(),
  endDate:                   isoDateString.nullable().optional(),
  legalEntityId:             z.string().optional(),
  areaId:                    z.string().optional(),
  demandManagerId:           z.string().optional(),
  demandOwner:               z.string().optional(),
  objective:                 z.string().optional(),
  necessity:                 z.string().optional(),
  isMandatory:               z.boolean().optional(),
  qualitativeValueCategory:  z.boolean().optional(),
  quantitativeValueCategory: z.boolean().optional(),
  reasoningForMandatory:     z.string().optional(),
  asisDescription:           z.string().optional(),
  benefitsObjectives:        z.string().optional(),
  tobeDescription:           z.string().optional(),
  isSmallProject:            z.boolean().optional(),
  isGxpRelevant:             z.boolean().optional(),
  businessControllerId:      z.string().optional(),
  demandScope:               z.enum(['GLOBAL', 'LOCAL']).nullable().optional(),
  countryId:                 z.string().cuid().nullable().optional(),
}).refine(
  d => !d.startDate || !d.endDate || d.endDate >= d.startDate,
  { message: 'End date cannot be before start date', path: ['endDate'] },
).refine(
  d => {
    if (!d.startDate && d.endDate) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return d.endDate >= today;
    }
    return true;
  },
  { message: 'End date cannot be in the past', path: ['endDate'] },
).superRefine((data, ctx) => {
  const type = data.isSmallProject ? 'SP' : 'P';
  const required = ['legalEntityId', 'areaId', 'demandManagerId', 'endDate',
                    'demandOwner', 'objective', 'necessity', 'demandScope'] as const;

  for (const field of required) {
    const val = data[field];
    if (val === null || val === undefined || val === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: field === 'demandScope' ? 'Please select Global or Local' : 'Required',
        path: [field],
      });
    }
  }

  if (data.demandScope === 'LOCAL' && !data.countryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Country is required for local demands',
      path: ['countryId'],
    });
  }

  if (type === 'P' && (!data.businessControllerId || data.businessControllerId === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Required',
      path: ['businessControllerId'],
    });
  }

  if (data.isMandatory && !data.reasoningForMandatory) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Required',
      path: ['reasoningForMandatory'],
    });
  }

  if ((data.qualitativeValueCategory || data.quantitativeValueCategory) && !data.benefitsObjectives) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Required',
      path: ['benefitsObjectives'],
    });
  }
});

export type DemandFormValues = z.infer<typeof demandFormSchema>;

// ── SP flow constants and schemas (Story 4.3) ─────────────────────────────────

export const SpStep = {
  DM_COST_ESTIMATION: 'DM_COST_ESTIMATION',
  DR_OFFER_REVIEW:    'DR_OFFER_REVIEW',
  PM_DECISION:        'PM_DECISION',
} as const;
export type SpStep = typeof SpStep[keyof typeof SpStep];

export const spAcceptSchema = z.object({});
export type SpAcceptDto = z.infer<typeof spAcceptSchema>;

export const spSubmitEstimateSchema = z.object({});
export type SpSubmitEstimateDto = z.infer<typeof spSubmitEstimateSchema>;

export const spAcceptOfferSchema = z.object({});
export type SpAcceptOfferDto = z.infer<typeof spAcceptOfferSchema>;

export const spReworkOfferSchema = z.object({
  commentary: z.string().min(1, 'A comment is required when requesting offer rework'),
});
export type SpReworkOfferDto = z.infer<typeof spReworkOfferSchema>;

// ── DM action schemas (Story 4.1) ──────────────────────────────────────────────

export const dmAssessmentBaseSchema = z.object({
  eaInvolved:          z.boolean().optional(),
  eaComment:           z.string().max(2000).optional(),
  itSecurityInvolved:  z.boolean().optional(),
  itSecurityComment:   z.string().max(2000).optional(),
  itOpsInvolved:       z.boolean().optional(),
  itOpsComment:        z.string().max(2000).optional(),
  fundingType:         z.enum(['Business', 'IT']).optional(),
  moveToSmallProject:  z.boolean().optional(),
  glAccountId:         z.string().cuid().nullable().optional(),
});

export const dmAcceptSchema = dmAssessmentBaseSchema;
export type DmAcceptDto = z.infer<typeof dmAcceptSchema>;

export const dmReturnSchema = dmAssessmentBaseSchema.extend({
  dmCommentary: z.string().min(1, 'DM commentary is required for rework requests'),
});
export type DmReturnDto = z.infer<typeof dmReturnSchema>;

export const dmRejectSchema = dmAssessmentBaseSchema.extend({
  dmCommentary: z.string().min(1, 'DM commentary is required for rejections'),
});
export type DmRejectDto = z.infer<typeof dmRejectSchema>;

export const dmPostponeSchema = z.object({
  onHoldReason: z.string().min(1, 'A reason is required to postpone'),
});
export type DmPostponeDto = z.infer<typeof dmPostponeSchema>;

export const saveDmAssessmentDraftSchema = z.object({
  eaInvolved:         z.boolean().nullable().optional(),
  eaComment:          z.string().max(2000).nullable().optional(),
  itSecurityInvolved: z.boolean().nullable().optional(),
  itSecurityComment:  z.string().max(2000).nullable().optional(),
  itOpsInvolved:      z.boolean().nullable().optional(),
  itOpsComment:       z.string().max(2000).nullable().optional(),
});
export type SaveDmAssessmentDraftDto = z.infer<typeof saveDmAssessmentDraftSchema>;

// Queue item — a lightweight projection for the DM queue list
export const dmQueueItemSchema = z.object({
  id:              z.string().cuid(),
  publicId:        z.number().int().positive(),
  title:           z.string(),
  status:          z.nativeEnum(DemandStatus),
  areaId:          z.string().nullable(),
  updatedAt:       z.string().datetime({ offset: true }),
  stalledDays:     z.number().int(),
  spStep:          z.string().nullable().optional(),
  isSmallProject:  z.boolean().optional(),
  statusChangedAt: z.string().datetime({ offset: true }).nullable(),
  requesterName:   z.string(),
  assigneeName:    z.string().nullable(),
});
export type DmQueueItem = z.infer<typeof dmQueueItemSchema>;

// Full demand shape returned by the API
export const demandResponseSchema = z.object({
  id:                        z.string().cuid(),
  publicId:                  z.number().int().positive(),
  title:                     z.string(),
  description:               z.string(),
  status:                    z.nativeEnum(DemandStatus),
  originatorId:              z.string().cuid(),
  costCentreId:              z.string().nullable(),
  glAccountId:               z.string().nullable(),
  startDate:                 z.string().datetime({ offset: true }).nullable(),
  endDate:                   z.string().datetime({ offset: true }).nullable(),
  draftSavedAt:              z.string().datetime({ offset: true }).nullable(),
  createdAt:                 z.string().datetime({ offset: true }),
  updatedAt:                 z.string().datetime({ offset: true }),
  legalEntityId:             z.string().nullable(),
  areaId:                    z.string().nullable(),
  demandManagerId:           z.string().nullable(),
  demandOwner:               z.string().nullable(),
  objective:                 z.string().nullable(),
  necessity:                 z.string().nullable(),
  isMandatory:               z.boolean(),
  qualitativeValueCategory:  z.boolean().nullable(),
  quantitativeValueCategory: z.boolean().nullable(),
  reasoningForMandatory:     z.string().nullable().optional(),
  asisDescription:           z.string().nullable(),
  benefitsObjectives:        z.string().nullable(),
  tobeDescription:           z.string().nullable(),
  isSmallProject:            z.boolean(),
  isGxpRelevant:             z.boolean(),
  projectType:               z.enum(['P', 'SP']),
  submittedAt:               z.string().datetime({ offset: true }).nullable(),
  // Story 4.1 — DM assessment fields
  dmDecision:               z.string().nullable().optional(),
  dmCommentary:             z.string().nullable().optional(),
  eaInvolved:               z.boolean().nullable().optional(),
  eaComment:                z.string().nullable().optional(),
  itSecurityInvolved:       z.boolean().nullable().optional(),
  itSecurityComment:        z.string().nullable().optional(),
  itOpsInvolved:            z.boolean().nullable().optional(),
  itOpsComment:             z.string().nullable().optional(),
  top10Conformity:          z.string().nullable().optional(),
  top10ConformityComments:  z.string().nullable().optional(),
  fundingType:              z.enum(['Business', 'IT']).nullable().optional(),
  moveToSmallProject:       z.boolean().nullable().optional(),
  onHoldReason:             z.string().nullable().optional(),
  dmActionedBy:             z.string().nullable().optional(),
  dmActionedAt:             z.string().datetime({ offset: true }).nullable().optional(),
  // Story 4.2 — PM approval fields
  pmCommentary:             z.string().nullable().optional(),
  pmActionedBy:             z.string().nullable().optional(),
  pmActionedAt:             z.string().datetime({ offset: true }).nullable().optional(),
  projectId:                z.string().cuid().nullable().optional(),
  // Story 4.3 — SP workflow sub-step
  spStep:                   z.string().nullable().optional(),
  drCommentary:             z.string().nullable().optional(),
  // Story 4.11 — BC workflow fields
  businessControllerId:     z.string().nullable().optional(),
  bcStatus:                 z.string().nullable().optional(),
  bcActionedBy:             z.string().nullable().optional(),
  bcActionedAt:             z.string().datetime({ offset: true }).nullable().optional(),
  bcCommentary:             z.string().nullable().optional(),
  // Story 2.14 — demand scope and country
  demandScope:              z.enum(['GLOBAL', 'LOCAL']).nullable().optional(),
  countryId:                z.string().nullable().optional(),
  country:                  z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable().optional(),
  // Resolved ref-data objects — present on GET endpoints; may be null on mutation responses
  costCentre:               z.object({ code: z.string(), name: z.string() }).nullable().optional(),
  legalEntity:              z.object({ code: z.string(), name: z.string() }).nullable().optional(),
  area:                     z.object({ code: z.string(), name: z.string() }).nullable().optional(),
});

export type DemandResponse = z.infer<typeof demandResponseSchema>;

// ── DM date editing schema (Story 2.13) ──────────────────────────────────────

export const updateDemandDatesSchema = z.object({
  startDate: isoDateString.nullable(),
  endDate:   isoDateString.nullable(),
}).superRefine((d, ctx) => {
  // AC-11: both must be provided together or both null
  const oneNull = (d.startDate == null) !== (d.endDate == null);
  if (oneNull) {
    ctx.addIssue({ code: 'custom', message: 'Both startDate and endDate must be provided together', path: ['endDate'] });
  }
  // AC-10: range check
  if (d.startDate && d.endDate && new Date(d.endDate) < new Date(d.startDate)) {
    ctx.addIssue({ code: 'custom', message: 'End date cannot be before start date', path: ['endDate'] });
  }
});
export type UpdateDemandDatesDto = z.infer<typeof updateDemandDatesSchema>;

// ── P→SP type switch schema (Story 4.14) ─────────────────────────────────────

export const convertToSpSchema = z.object({});
export type ConvertToSpDto = z.infer<typeof convertToSpSchema>;

// ── BC action schemas (Story 4.11) ────────────────────────────────────────────

export const bcRejectSchema = z.object({
  commentary: z.string().min(1, 'Rejection reason is required'),
});
export type BcRejectDto = z.infer<typeof bcRejectSchema>;

export const bcSendToRequesterSchema = z.object({
  commentary: z.string().min(1, 'Comment is required'),
});
export type BcSendToRequesterDto = z.infer<typeof bcSendToRequesterSchema>;

export const bcQueueItemSchema = z.object({
  id:              z.string().cuid(),
  publicId:        z.number().int().positive(),
  title:           z.string(),
  status:          z.nativeEnum(DemandStatus),
  areaId:          z.string().nullable(),
  updatedAt:       z.string().datetime({ offset: true }),
  stalledDays:     z.number().int(),
  isSmallProject:  z.boolean().optional(),
  statusChangedAt: z.string().datetime({ offset: true }).nullable(),
  requesterName:   z.string(),
  assigneeName:    z.string().nullable(),
});
export type BcQueueItem = z.infer<typeof bcQueueItemSchema>;

// ── PM action schemas (Story 4.2) ──────────────────────────────────────────────

export const pmApproveSchema = z.object({
  assignedPmId: z.string().optional(),
});
export type PmApproveDto = z.infer<typeof pmApproveSchema>;

export const pmRejectSchema = z.object({
  pmCommentary: z.string().min(1, 'PM commentary is required for rejections'),
});
export type PmRejectDto = z.infer<typeof pmRejectSchema>;

export const pmSendBackSchema = z.object({
  target: z.enum(['requester', 'dm']),
  commentary: z.string().min(1, 'Commentary is required for send-back'),
});
export type PmSendBackDto = z.infer<typeof pmSendBackSchema>;

export const pmQueueItemSchema = z.object({
  id:              z.string().cuid(),
  publicId:        z.number().int().positive(),
  title:           z.string(),
  status:          z.nativeEnum(DemandStatus),
  costCentreId:    z.string().nullable(),
  updatedAt:       z.string().datetime({ offset: true }),
  stalledDays:     z.number().int(),
  isSmallProject:  z.boolean().optional(),
  statusChangedAt: z.string().datetime({ offset: true }).nullable(),
  requesterName:   z.string(),
  assigneeName:    z.string().nullable(),
});
export type PmQueueItem = z.infer<typeof pmQueueItemSchema>;

// ── Unified queue item (Story 4.15) ──────────────────────────────────────────

export const unifiedQueueItemSchema = z.object({
  id:             z.string().cuid(),
  publicId:       z.number().int().positive(),
  title:          z.string(),
  status:         z.nativeEnum(DemandStatus),
  areaId:         z.string().nullable().optional(),
  costCentreId:   z.string().nullable().optional(),
  updatedAt:      z.string().datetime({ offset: true }),
  stalledDays:    z.number().int(),
  spStep:         z.string().nullable().optional(),
  isSmallProject:  z.boolean().optional(),
  statusChangedAt: z.string().datetime({ offset: true }).nullable(),
  requesterName:   z.string(),
  assigneeName:    z.string().nullable(),
  requiredRole:    z.enum(['DemandManager', 'BusinessController', 'PortfolioManager', 'DemandRequester']),
});
export type UnifiedQueueItem = z.infer<typeof unifiedQueueItemSchema>;

export const demandHistoryItemSchema = z.object({
  id:        z.string().cuid(),
  eventType: z.string(),
  changedBy: z.string(),
  actorName: z.string(),
  changedAt: z.string().datetime({ offset: true }),
  before:    z.unknown().nullable(),
  after:     z.unknown().nullable(),
});
export type DemandHistoryItem = z.infer<typeof demandHistoryItemSchema>;

// ── Dashboard stats schema (Story 4.6) ────────────────────────────────────────

export const dashboardStatsResponseSchema = z.object({
  totalActiveDemands:     z.number().int().nonnegative(),
  budgetCommittedCents:   z.number().int().nonnegative(),
  budgetPlannedCents:     z.number().int().nonnegative(),
  demandsPendingDecision: z.number().int().nonnegative(),
  stalledDemands:         z.array(demandResponseSchema),
});
export type DashboardStatsResponse = z.infer<typeof dashboardStatsResponseSchema>;
