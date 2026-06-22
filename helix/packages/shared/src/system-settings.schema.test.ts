import { describe, it, expect } from 'vitest';
import { systemSettingsResponseSchema } from './system-settings.schema';

const VALID_FULL = {
  spThresholdEurCents:  5_000_000,
  intakeWindowStart:    null,
  intakeWindowEnd:      null,
  budgetCycleStart:     null,
  budgetCycleEnd:       null,
  gxpItValidationDays:  30,
  gxpDocumentationDays: 14,
};

describe('systemSettingsResponseSchema', () => {
  it('accepts valid full shape', () => {
    expect(systemSettingsResponseSchema.safeParse(VALID_FULL).success).toBe(true);
  });

  it('accepts valid shape with ISO date strings', () => {
    const result = systemSettingsResponseSchema.safeParse({
      ...VALID_FULL,
      intakeWindowStart: '2026-06-01T00:00:00.000Z',
      intakeWindowEnd:   '2026-06-30T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative gxpItValidationDays', () => {
    expect(systemSettingsResponseSchema.safeParse({ ...VALID_FULL, gxpItValidationDays: -1 }).success).toBe(false);
  });

  it('rejects zero gxpDocumentationDays', () => {
    expect(systemSettingsResponseSchema.safeParse({ ...VALID_FULL, gxpDocumentationDays: 0 }).success).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(systemSettingsResponseSchema.safeParse({ ...VALID_FULL, gxpItValidationDays: 30.5 }).success).toBe(false);
  });

  it('rejects negative spThresholdEurCents', () => {
    expect(systemSettingsResponseSchema.safeParse({ ...VALID_FULL, spThresholdEurCents: -1 }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(systemSettingsResponseSchema.safeParse({ gxpItValidationDays: 30 }).success).toBe(false);
  });
});
