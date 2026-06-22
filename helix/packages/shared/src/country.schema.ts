import { z } from 'zod';

export const countryResponseSchema = z.object({
  id:   z.string(),
  code: z.string(),
  name: z.string(),
});

export type CountryResponse = z.infer<typeof countryResponseSchema>;

export const countryAdminRowSchema = z.object({
  id:        z.string(),
  code:      z.string(),
  name:      z.string(),
  isActive:  z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type CountryAdminRow = z.infer<typeof countryAdminRowSchema>;

export const createCountrySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
});
export type CreateCountryDto = z.infer<typeof createCountrySchema>;

export const updateCountrySchema = z
  .object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(200).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
export type UpdateCountryDto = z.infer<typeof updateCountrySchema>;
