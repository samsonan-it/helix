import { z } from 'zod';

export const legalEntityResponseSchema = z.object({
  id:   z.string(),
  code: z.string(),
  name: z.string(),
});

export type LegalEntityResponse = z.infer<typeof legalEntityResponseSchema>;

export const legalEntityAdminRowSchema = z.object({
  id:                    z.string(),
  code:                  z.string(),
  name:                  z.string(),
  country:               z.string().nullable(),
  mandatoryTimesheeting: z.boolean(),
  isActive:              z.boolean(),
  createdAt:             z.string(),
  updatedAt:             z.string().nullable(),
  updatedBy:             z.string().nullable(),
});
export type LegalEntityAdminRow = z.infer<typeof legalEntityAdminRowSchema>;

export const createLegalEntitySchema = z.object({
  code:                  z.string().min(1).max(50),
  name:                  z.string().min(1).max(200),
  country:               z.string().min(1).max(10),
  mandatoryTimesheeting: z.boolean().default(false),
});
export type CreateLegalEntityDto = z.infer<typeof createLegalEntitySchema>;

export const updateLegalEntitySchema = z
  .object({
    code:                  z.string().min(1).max(50).optional(),
    name:                  z.string().min(1).max(200).optional(),
    country:               z.string().min(1).max(10).optional(),
    mandatoryTimesheeting: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
export type UpdateLegalEntityDto = z.infer<typeof updateLegalEntitySchema>;
