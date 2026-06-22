import { describe, it, expect } from 'vitest';
import { aiPrefillRequestSchema, aiPrefillResponseSchema } from './ai-prefill.schema';

describe('aiPrefillRequestSchema', () => {
  it('accepts a non-empty description', () => {
    const result = aiPrefillRequestSchema.safeParse({ description: 'hello' });
    expect(result.success).toBe(true);
  });

  it('rejects empty description', () => {
    const result = aiPrefillRequestSchema.safeParse({ description: '' });
    expect(result.success).toBe(false);
  });
});

describe('aiPrefillResponseSchema', () => {
  it('accepts a valid full response with new fields', () => {
    const result = aiPrefillResponseSchema.safeParse({
      title: 'My demand',
      costCentreId: 'cc-1',
      description: 'A brief summary',
      objective: 'To improve efficiency',
      necessity: 'Required by regulation',
      benefitsObjectives: 'Cost savings',
      estimatedCostCents: 4_500_000,
      confidence: {
        title: 'HIGH',
        description: 'MEDIUM',
        objective: 'LOW',
        necessity: null,
        benefitsObjectives: 'HIGH',
        estimatedCostCents: 'MEDIUM',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an all-null response', () => {
    const result = aiPrefillResponseSchema.safeParse({
      title: null,
      costCentreId: null,
      description: null,
      objective: null,
      necessity: null,
      benefitsObjectives: null,
      estimatedCostCents: null,
      confidence: {},
    });
    expect(result.success).toBe(true);
  });

  it('accepts a response with no fields (minimal)', () => {
    const result = aiPrefillResponseSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.confidence).toEqual({});
  });

  it('strips unknown fields', () => {
    const result = aiPrefillResponseSchema.safeParse({
      title: 'Test',
      unknownField: 'should be stripped',
    });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  it('accepts estimatedCostCents as integer', () => {
    const result = aiPrefillResponseSchema.safeParse({ estimatedCostCents: 5_000_000 });
    expect(result.success).toBe(true);
    expect(result.data?.estimatedCostCents).toBe(5_000_000);
  });

  it('rejects estimatedCostCents as float', () => {
    const result = aiPrefillResponseSchema.safeParse({ estimatedCostCents: 4500.5 });
    expect(result.success).toBe(false);
  });

  it('does not contain glAccountId, estimatedCostRange, or demandType', () => {
    const result = aiPrefillResponseSchema.safeParse({
      glAccountId: 'ga-1',
      estimatedCostRange: '10k-50k',
      demandType: 'Project',
    });
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data['glAccountId']).toBeUndefined();
    expect(data['estimatedCostRange']).toBeUndefined();
    expect(data['demandType']).toBeUndefined();
  });
});
