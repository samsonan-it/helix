import { describe, it, expect } from 'vitest';
import {
  monetaryValueSchema,
  financialGlAccountSchema,
  financialPlanEntrySchema,
  financialPlanResponseSchema,
  updateFinancialPlanEntryItemSchema,
  updateFinancialPlanEntriesSchema,
} from './financial-plan.schema';

describe('monetaryValueSchema', () => {
  it('accepts integer cents', () => {
    expect(monetaryValueSchema.parse(40050)).toBe(40050);
    expect(monetaryValueSchema.parse(0)).toBe(0);
  });

  it('rejects floats', () => {
    expect(() => monetaryValueSchema.parse(400.5)).toThrow();
    expect(() => monetaryValueSchema.parse(0.01)).toThrow();
  });

  it('rejects negative values', () => {
    expect(() => monetaryValueSchema.parse(-1)).toThrow();
  });
});

describe('financialGlAccountSchema', () => {
  it('accepts a valid gl account row', () => {
    const result = financialGlAccountSchema.parse({
      id: 'cuid-1',
      category: 'opex',
      label: 'IT Consultancy',
      isActive: true,
    });
    expect(result.category).toBe('opex');
  });

  it('rejects unknown category', () => {
    expect(() =>
      financialGlAccountSchema.parse({ id: 'x', category: 'unknown', label: 'X', isActive: true }),
    ).toThrow();
  });

  it('accepts all three valid categories', () => {
    for (const category of ['benefits', 'opex', 'capex'] as const) {
      expect(() =>
        financialGlAccountSchema.parse({ id: 'x', category, label: 'X', isActive: true }),
      ).not.toThrow();
    }
  });
});

describe('financialPlanEntrySchema', () => {
  it('accepts a valid entry', () => {
    const result = financialPlanEntrySchema.parse({
      id: 'entry-1',
      glAccountId: 'gl-1',
      category: 'opex',
      month: 3,
      year: 2026,
      valueCents: 50000,
      isActual: false,
      isUserSet: true,
    });
    expect(result.valueCents).toBe(50000);
    expect(result.category).toBe('opex');
  });

  it('rejects missing category', () => {
    expect(() =>
      financialPlanEntrySchema.parse({ id: 'e', glAccountId: 'g', month: 1, year: 2026, valueCents: 0, isActual: false, isUserSet: false }),
    ).toThrow();
  });

  it('rejects month outside 1–12', () => {
    expect(() =>
      financialPlanEntrySchema.parse({ id: 'e', glAccountId: 'g', category: 'opex', month: 0, year: 2026, valueCents: 0, isActual: false, isUserSet: false }),
    ).toThrow();
    expect(() =>
      financialPlanEntrySchema.parse({ id: 'e', glAccountId: 'g', category: 'opex', month: 13, year: 2026, valueCents: 0, isActual: false, isUserSet: false }),
    ).toThrow();
  });

  it('rejects float valueCents', () => {
    expect(() =>
      financialPlanEntrySchema.parse({ id: 'e', glAccountId: 'g', category: 'opex', month: 1, year: 2026, valueCents: 100.5, isActual: false, isUserSet: false }),
    ).toThrow();
  });
});

describe('financialPlanResponseSchema', () => {
  it('parses valid response shape', () => {
    const result = financialPlanResponseSchema.parse({
      glAccounts: [{ id: 'gl-1', category: 'opex', label: 'IT Consultancy', isActive: true }],
      entries: [{ id: 'entry-1', glAccountId: 'gl-1', category: 'opex', month: 1, year: 2026, valueCents: 0, isActual: false, isUserSet: false }],
    });
    expect(result.glAccounts).toHaveLength(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].category).toBe('opex');
  });

  it('rejects missing glAccounts', () => {
    expect(() => financialPlanResponseSchema.parse({ entries: [] })).toThrow();
  });
});

describe('updateFinancialPlanEntryItemSchema', () => {
  it('accepts valid entry item', () => {
    const result = updateFinancialPlanEntryItemSchema.parse({
      glAccountId: 'gl-1',
      category: 'capex',
      month: 6,
      year: 2026,
      valueCents: 15000,
    });
    expect(result.month).toBe(6);
    expect(result.category).toBe('capex');
  });

  it('rejects missing category', () => {
    expect(() =>
      updateFinancialPlanEntryItemSchema.parse({ glAccountId: 'g', month: 1, year: 2026, valueCents: 0 }),
    ).toThrow();
  });

  it('rejects float valueCents', () => {
    expect(() =>
      updateFinancialPlanEntryItemSchema.parse({ glAccountId: 'g', category: 'opex', month: 1, year: 2026, valueCents: 100.5 }),
    ).toThrow();
  });
});

describe('updateFinancialPlanEntriesSchema', () => {
  it('accepts array of entry items', () => {
    const result = updateFinancialPlanEntriesSchema.parse({
      entries: [{ glAccountId: 'gl-1', category: 'opex', month: 3, year: 2026, valueCents: 0 }],
    });
    expect(result.entries).toHaveLength(1);
  });

  it('rejects empty entries array', () => {
    expect(() => updateFinancialPlanEntriesSchema.parse({ entries: [] })).toThrow();
  });
});
