import { z } from 'zod';

export const ConfidenceLevel = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type ConfidenceLevel = typeof ConfidenceLevel[keyof typeof ConfidenceLevel];

export const aiPrefillRequestSchema = z.object({
  description: z.string().min(1).max(2000),
});

export type AIPrefillRequest = z.infer<typeof aiPrefillRequestSchema>;

export const aiPrefillResponseSchema = z
  .object({
    title:                z.string().nullable().optional(),
    costCentreId:         z.string().nullable().optional(),
    description:          z.string().nullable().optional(),
    objective:            z.string().nullable().optional(),
    necessity:            z.string().nullable().optional(),
    benefitsObjectives:   z.string().nullable().optional(),
    estimatedCostCents:   z.number().int().nullable().optional(),
    confidence: z
      .object({
        title:              z.nativeEnum(ConfidenceLevel).nullable().optional(),
        description:        z.nativeEnum(ConfidenceLevel).nullable().optional(),
        objective:          z.nativeEnum(ConfidenceLevel).nullable().optional(),
        necessity:          z.nativeEnum(ConfidenceLevel).nullable().optional(),
        benefitsObjectives: z.nativeEnum(ConfidenceLevel).nullable().optional(),
        estimatedCostCents: z.nativeEnum(ConfidenceLevel).nullable().optional(),
      })
      .optional()
      .default({}),
  })
  .strip();

export type AIPrefillResponse = z.infer<typeof aiPrefillResponseSchema>;
