import { describe, it, expect } from 'vitest';
import {
  DemandStatus,
  VALID_TRANSITIONS,
  createDemandSchema,
  updateDraftDemandSchema,
  updateDemandDatesSchema,
  step2Schema,
  step3Schema,
  demandResponseSchema,
  demandFormSchema,
  pmSendBackSchema,
  unifiedQueueItemSchema,
} from './demand.schema';

describe('DemandStatus enum', () => {
  it('exports all 12 status values', () => {
    const values = Object.values(DemandStatus);
    expect(values).toHaveLength(12);
    expect(values).toContain('DRAFT');
    expect(values).toContain('SUBMITTED');
    expect(values).toContain('SP_OFFER_REVIEW');
    expect(values).toContain('IN_REVIEW');
    expect(values).toContain('BC_REVIEW');
    expect(values).toContain('APPROVED');
    expect(values).toContain('REJECTED');
    expect(values).toContain('REROUTED');
    expect(values).toContain('ON_HOLD');
    expect(values).toContain('IN_EXECUTION');
    expect(values).toContain('COMPLETED');
    expect(values).toContain('CANCELLED');
  });
});

describe('VALID_TRANSITIONS table', () => {
  it('has an entry for every DemandStatus value', () => {
    for (const status of Object.values(DemandStatus)) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    expect(VALID_TRANSITIONS[DemandStatus.COMPLETED]).toHaveLength(0);
    expect(VALID_TRANSITIONS[DemandStatus.CANCELLED]).toHaveLength(0);
  });

  it('only lists valid DemandStatus values as targets', () => {
    const validValues = new Set(Object.values(DemandStatus));
    for (const targets of Object.values(VALID_TRANSITIONS)) {
      for (const target of targets) {
        expect(validValues.has(target)).toBe(true);
      }
    }
  });

  it('DRAFT can transition to SUBMITTED and CANCELLED only', () => {
    expect(VALID_TRANSITIONS[DemandStatus.DRAFT]).toEqual(
      expect.arrayContaining([DemandStatus.SUBMITTED, DemandStatus.CANCELLED]),
    );
    expect(VALID_TRANSITIONS[DemandStatus.DRAFT]).toHaveLength(2);
  });

  it('REROUTED can transition to SUBMITTED', () => {
    expect(VALID_TRANSITIONS[DemandStatus.REROUTED]).toContain(DemandStatus.SUBMITTED);
  });

  it('IN_REVIEW can transition to SUBMITTED (Story 4.13 — PM send back to DM)', () => {
    expect(VALID_TRANSITIONS[DemandStatus.IN_REVIEW]).toContain(DemandStatus.SUBMITTED);
  });
});

describe('createDemandSchema', () => {
  it('accepts a valid demand with title and description', () => {
    const result = createDemandSchema.safeParse({
      title:       'My Project',
      description: 'A description',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional date fields as ISO strings', () => {
    const result = createDemandSchema.safeParse({
      title:       'My Project',
      description: 'A description',
      startDate:   '2026-07-01',
      endDate:     '2026-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createDemandSchema.safeParse({
      title:       '',
      description: 'desc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    const result = createDemandSchema.safeParse({
      title:       'x'.repeat(201),
      description: 'desc',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid costCentreId', () => {
    const result = createDemandSchema.safeParse({
      title:        'My Project',
      description:  'A description',
      costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
    });
    expect(result.success).toBe(true);
  });

  it('rejects calendar-impossible bare date', () => {
    const result = createDemandSchema.safeParse({
      title:     'My Project',
      description: 'desc',
      startDate: '2026-02-31',
    });
    expect(result.success).toBe(false);
  });

  it('rejects inverted date range', () => {
    const result = createDemandSchema.safeParse({
      title:       'My Project',
      description: 'desc',
      startDate:   '2026-12-01',
      endDate:     '2026-07-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateDraftDemandSchema', () => {
  it('accepts empty object — all fields optional', () => {
    expect(updateDraftDemandSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update', () => {
    expect(updateDraftDemandSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });

  it('rejects title exceeding 200 chars', () => {
    expect(updateDraftDemandSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
  });

  it('rejects inverted date range', () => {
    expect(updateDraftDemandSchema.safeParse({
      startDate: '2026-12-01',
      endDate:   '2026-07-01',
    }).success).toBe(false);
  });
});

describe('step2Schema date validation', () => {
  it('rejects endDate before startDate', () => {
    const result = step2Schema.safeParse({
      costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
      startDate:    '2026-12-01',
      endDate:      '2026-07-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('End date cannot be before start date');
  });

  it('accepts valid date range', () => {
    expect(step2Schema.safeParse({
      costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
      startDate:    '2026-07-01',
      endDate:      '2026-12-31',
    }).success).toBe(true);
  });

  it('accepts equal start and end date', () => {
    expect(step2Schema.safeParse({
      costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
      startDate:    '2026-07-01',
      endDate:      '2026-07-01',
    }).success).toBe(true);
  });

  it('accepts when dates are omitted', () => {
    expect(step2Schema.safeParse({
      costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
    }).success).toBe(true);
  });
});

describe('demandResponseSchema', () => {
  it('parses a valid API response', () => {
    const result = demandResponseSchema.safeParse({
      id:                        'cjld2cjxh0000qzrmn831i7rn',
      publicId:                  1,
      title:                     'Test',
      description:               'Test desc',
      status:                    DemandStatus.DRAFT,
      originatorId:              'cjld2cjxh0001qzrmn831i7rn',
      costCentreId:              null,
      glAccountId:               null,
      startDate:                 null,
      endDate:                   null,
      draftSavedAt:              null,
      createdAt:                 '2026-07-01T00:00:00.000Z',
      updatedAt:                 '2026-07-01T00:00:00.000Z',
      legalEntityId:             null,
      areaId:                    null,
      demandManagerId:           null,
      demandOwner:               null,
      objective:                 null,
      necessity:                 null,
      isMandatory:               false,
      qualitativeValueCategory:  null,
      quantitativeValueCategory: null,
      asisDescription:           null,
      benefitsObjectives:        null,
      tobeDescription:           null,
      isSmallProject:            false,
      isGxpRelevant:             false,
      projectType:               'P',
      submittedAt:               null,
    });
    expect(result.success).toBe(true);
  });
});

describe('updateDraftDemandSchema — Story 2.2 new fields', () => {
  it('accepts all new fields with boolean value categories', () => {
    const result = updateDraftDemandSchema.safeParse({
      legalEntityId:             'cjld2cjxh0000qzrmn831i7rn',
      areaId:                    'cjld2cjxh0001qzrmn831i7rn',
      demandManagerId:           'cjld2cjxh0002qzrmn831i7rn',
      demandOwner:               'Jane Doe',
      objective:                 'Deliver X',
      necessity:                 'Compliance',
      isMandatory:               true,
      qualitativeValueCategory:  true,
      quantitativeValueCategory: false,
      reasoningForMandatory:     'Legal obligation',
      asisDescription:           'As-is',
      benefitsObjectives:        'Benefits',
      tobeDescription:           'To-be',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial new fields', () => {
    expect(updateDraftDemandSchema.safeParse({ objective: 'Deliver X' }).success).toBe(true);
  });
});

describe('createDemandSchema — Story 2.2 isMandatory default', () => {
  it('accepts creation without isMandatory (defaults to false in DB)', () => {
    const result = createDemandSchema.safeParse({
      title:       'Test',
      description: 'Desc',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isMandatory).toBeUndefined();
    }
  });
});

describe('step3Schema — Objectives step', () => {
  it('always passes with empty object', () => {
    expect(step3Schema.safeParse({}).success).toBe(true);
  });

  it('accepts all objectives fields with boolean value categories', () => {
    expect(step3Schema.safeParse({
      objective:                 'Deliver X',
      necessity:                 'Compliance',
      isMandatory:               true,
      qualitativeValueCategory:  true,
      quantitativeValueCategory: false,
      reasoningForMandatory:     'Legal obligation',
      asisDescription:           'As-is',
      benefitsObjectives:        'Benefits',
      tobeDescription:           'To-be',
    }).success).toBe(true);
  });
});

// Story 2.12: BC is required for P; objective/necessity/demandOwner required for both P and SP.
// Story 2.14: demandScope is required for all demand types.
const validPBase = {
  title: 'My Demand',
  description: 'A description',
  costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
  isSmallProject: false,
  legalEntityId: 'cjld2cjxh0001qzrmn831i7rn',
  areaId: 'cjld2cjxh0002qzrmn831i7rn',
  demandManagerId: 'cjld2cjxh0003qzrmn831i7rn',
  businessControllerId: 'cjld2cjxh0004qzrmn831i7rn',
  endDate: '2026-12-31',
  demandOwner: 'Jane Doe',
  objective: 'Deliver X',
  necessity: 'Compliance',
  demandScope: 'GLOBAL' as const,
};

// SP required fields now align with P (Story 2.12): objective/necessity/demandOwner required; asis/tobe optional.
// Story 2.14: demandScope is required for SP as well.
const validSPBase = {
  title: 'My SP Demand',
  description: 'A description',
  costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
  isSmallProject: true,
  legalEntityId: 'cjld2cjxh0001qzrmn831i7rn',
  areaId: 'cjld2cjxh0002qzrmn831i7rn',
  demandManagerId: 'cjld2cjxh0003qzrmn831i7rn',
  endDate: '2026-12-31',
  demandOwner: 'Jane Doe',
  objective: 'Deliver X',
  necessity: 'Compliance',
  demandScope: 'GLOBAL' as const,
};

describe('demandFormSchema — superRefine type-conditional validation', () => {
  it('P type: accepts when all required fields are present', () => {
    expect(demandFormSchema.safeParse(validPBase).success).toBe(true);
  });

  it('SP type: accepts when all SP required fields are present', () => {
    expect(demandFormSchema.safeParse(validSPBase).success).toBe(true);
  });

  it('P type: rejects when legalEntityId is missing', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, legalEntityId: '' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map(i => i.path[0]);
    expect(paths).toContain('legalEntityId');
  });

  it('P type: rejects when demandManagerId is missing', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, demandManagerId: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(i => i.path[0])).toContain('demandManagerId');
  });

  it('P type: rejects when objective is missing', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, objective: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(i => i.path[0])).toContain('objective');
  });

  // Story 2.12: asisDescription is now optional for SP (no longer required).
  it('SP type: asisDescription is optional — submission passes without it', () => {
    const result = demandFormSchema.safeParse({ ...validSPBase, asisDescription: '' });
    expect(result.success).toBe(true);
  });

  // Story 2.12: objective is now required for SP (aligned with P).
  it('SP type: requires objective (aligned with P — Story 2.12)', () => {
    const result = demandFormSchema.safeParse({ ...validSPBase, objective: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(i => i.path[0])).toContain('objective');
  });

  it('P type: does NOT require asisDescription (optional for all demand types)', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, asisDescription: '' });
    expect(result.success).toBe(true);
  });

  // Story 2.12: businessControllerId is required for P.
  it('P type: requires businessControllerId', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, businessControllerId: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(i => i.path[0])).toContain('businessControllerId');
  });

  // Story 2.12: businessControllerId is NOT required for SP (field not shown).
  it('SP type: does NOT require businessControllerId', () => {
    const result = demandFormSchema.safeParse({ ...validSPBase, businessControllerId: '' });
    expect(result.success).toBe(true);
  });

  // Story 2.12: demandOwner is now required for SP (aligned with P).
  it('SP type: requires demandOwner (aligned with P — Story 2.12)', () => {
    const result = demandFormSchema.safeParse({ ...validSPBase, demandOwner: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(i => i.path[0])).toContain('demandOwner');
  });
});

describe('demandFormSchema — Story 2.8 new validation rules', () => {
  it('reasoningForMandatory required when isMandatory is true', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, isMandatory: true });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map(i => i.path[0]);
    expect(paths).toContain('reasoningForMandatory');
  });

  it('reasoningForMandatory not required when isMandatory is false', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, isMandatory: false });
    expect(result.success).toBe(true);
  });

  it('reasoningForMandatory present clears the error when isMandatory is true', () => {
    const result = demandFormSchema.safeParse({
      ...validPBase,
      isMandatory: true,
      reasoningForMandatory: 'Legal obligation',
    });
    expect(result.success).toBe(true);
  });

  it('benefitsObjectives required when qualitativeValueCategory is true', () => {
    const result = demandFormSchema.safeParse({
      ...validPBase,
      qualitativeValueCategory: true,
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map(i => i.path[0]);
    expect(paths).toContain('benefitsObjectives');
  });

  it('benefitsObjectives required when quantitativeValueCategory is true', () => {
    const result = demandFormSchema.safeParse({
      ...validPBase,
      quantitativeValueCategory: true,
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map(i => i.path[0]);
    expect(paths).toContain('benefitsObjectives');
  });

  it('benefitsObjectives not required when both value categories are false', () => {
    const result = demandFormSchema.safeParse({
      ...validPBase,
      qualitativeValueCategory: false,
      quantitativeValueCategory: false,
    });
    expect(result.success).toBe(true);
  });

  it('end date in past rejected when startDate is absent', () => {
    const result = demandFormSchema.safeParse({
      ...validPBase,
      endDate: '2020-01-01',
    });
    expect(result.success).toBe(false);
    const endDateIssues = result.error?.issues.filter(i => i.path[0] === 'endDate');
    expect(endDateIssues?.some(i => i.message === 'End date cannot be in the past')).toBe(true);
  });

  it('end date in past allowed when startDate is present (start-date rule takes precedence)', () => {
    const result = demandFormSchema.safeParse({
      ...validPBase,
      startDate: '2020-01-01',
      endDate: '2020-06-01',
    });
    expect(result.success).toBe(true);
  });

  it('end date today or later passes when startDate absent', () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const result = demandFormSchema.safeParse({
      ...validPBase,
      endDate: today,
    });
    expect(result.success).toBe(true);
  });
});

describe('pmSendBackSchema (Story 4.13)', () => {
  it('accepts valid requester target with commentary', () => {
    const result = pmSendBackSchema.safeParse({ target: 'requester', commentary: 'Needs revision' });
    expect(result.success).toBe(true);
  });

  it('accepts valid dm target with commentary', () => {
    const result = pmSendBackSchema.safeParse({ target: 'dm', commentary: 'Estimation incomplete' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown target value', () => {
    const result = pmSendBackSchema.safeParse({ target: 'cto', commentary: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects empty commentary', () => {
    const result = pmSendBackSchema.safeParse({ target: 'requester', commentary: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing commentary', () => {
    const result = pmSendBackSchema.safeParse({ target: 'requester' });
    expect(result.success).toBe(false);
  });
});

describe('unifiedQueueItemSchema', () => {
  const validItem = {
    id: 'clxxxxxxxxxxxxxxxxxxxxxx01',
    publicId: 1,
    title: 'Test demand',
    status: DemandStatus.SUBMITTED,
    updatedAt: '2026-06-08T10:00:00.000Z',
    stalledDays: 3,
    statusChangedAt: '2026-06-01T08:00:00.000Z',
    requesterName: 'Jane Requester',
    assigneeName: null,
    requiredRole: 'DemandManager',
  };

  it('accepts a valid DM unified queue item', () => {
    expect(unifiedQueueItemSchema.safeParse(validItem).success).toBe(true);
  });

  it('accepts BC and PM requiredRole values', () => {
    expect(unifiedQueueItemSchema.safeParse({ ...validItem, requiredRole: 'BusinessController' }).success).toBe(true);
    expect(unifiedQueueItemSchema.safeParse({ ...validItem, requiredRole: 'PortfolioManager' }).success).toBe(true);
  });

  it('rejects unknown requiredRole', () => {
    expect(unifiedQueueItemSchema.safeParse({ ...validItem, requiredRole: 'Admin' }).success).toBe(false);
  });

  it('accepts optional areaId and costCentreId', () => {
    const result = unifiedQueueItemSchema.safeParse({
      ...validItem,
      areaId: 'clxxxxxxxxxxxxxxxxxxxxxx02',
      costCentreId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing requiredRole', () => {
    const { requiredRole: _, ...noRole } = validItem;
    expect(unifiedQueueItemSchema.safeParse(noRole).success).toBe(false);
  });
});

// ── updateDemandDatesSchema (Story 2.13) ──────────────────────────────────────

describe('updateDemandDatesSchema', () => {
  it('accepts a valid ISO date pair', () => {
    const result = updateDemandDatesSchema.safeParse({ startDate: '2026-03-01', endDate: '2026-09-30' });
    expect(result.success).toBe(true);
  });

  it('accepts both dates null (AC-11)', () => {
    const result = updateDemandDatesSchema.safeParse({ startDate: null, endDate: null });
    expect(result.success).toBe(true);
  });

  it('rejects endDate < startDate (AC-10)', () => {
    const result = updateDemandDatesSchema.safeParse({ startDate: '2026-09-01', endDate: '2026-03-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'End date cannot be before start date')).toBe(true);
    }
  });

  it('rejects startDate set but endDate null (AC-11)', () => {
    const result = updateDemandDatesSchema.safeParse({ startDate: '2026-03-01', endDate: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Both startDate and endDate must be provided together')).toBe(true);
    }
  });

  it('rejects endDate set but startDate null (AC-11)', () => {
    const result = updateDemandDatesSchema.safeParse({ startDate: null, endDate: '2026-09-30' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Both startDate and endDate must be provided together')).toBe(true);
    }
  });

  it('rejects missing startDate field entirely (AC-11)', () => {
    const result = updateDemandDatesSchema.safeParse({ endDate: '2026-09-30' });
    expect(result.success).toBe(false);
  });

  it('accepts same-day range (startDate === endDate)', () => {
    const result = updateDemandDatesSchema.safeParse({ startDate: '2026-06-15', endDate: '2026-06-15' });
    expect(result.success).toBe(true);
  });

  it('accepts full ISO 8601 datetime with offset', () => {
    const result = updateDemandDatesSchema.safeParse({
      startDate: '2026-03-01T00:00:00.000Z',
      endDate:   '2026-09-30T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });
});

// ── demandFormSchema — Story 2.14 demand scope validation ─────────────────────

describe('demandFormSchema — Story 2.14 demand scope and country', () => {
  it('fails when demandScope is missing', () => {
    const { demandScope: _, ...withoutScope } = validPBase;
    const result = demandFormSchema.safeParse(withoutScope);
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map(i => i.path[0]);
    expect(paths).toContain('demandScope');
  });

  it('fails when demandScope is LOCAL and countryId is absent', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, demandScope: 'LOCAL' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map(i => i.path[0]);
    expect(paths).toContain('countryId');
    const countryIssue = result.error?.issues.find(i => i.path[0] === 'countryId');
    expect(countryIssue?.message).toBe('Country is required for local demands');
  });

  it('passes when demandScope is LOCAL and countryId is present', () => {
    const result = demandFormSchema.safeParse({
      ...validPBase,
      demandScope: 'LOCAL',
      countryId: 'cjld2cjxh0005qzrmn831i7rn',
    });
    expect(result.success).toBe(true);
  });

  it('passes when demandScope is GLOBAL with no countryId', () => {
    const result = demandFormSchema.safeParse({ ...validPBase, demandScope: 'GLOBAL' });
    expect(result.success).toBe(true);
  });
});

