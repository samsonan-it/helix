import { z } from 'zod';

export const glAccountCategorySchema = z.enum(['benefits', 'opex', 'capex']);
export type GlAccountCategory = z.infer<typeof glAccountCategorySchema>;

export const glAccountCategoriesSchema = z.array(glAccountCategorySchema).min(1);

export const glAccountResponseSchema = z.object({
  id:         z.string(),
  code:       z.string(),
  name:       z.string(),
  categories: glAccountCategoriesSchema,
  isActive:   z.boolean(),
});

export type GlAccountResponse = z.infer<typeof glAccountResponseSchema>;

export const glAccountAdminRowSchema = z.object({
  id:          z.string(),
  code:        z.string(),
  name:        z.string(),
  description: z.string().nullable(),
  categories:  glAccountCategoriesSchema,
  isActive:    z.boolean(),
  createdAt:   z.string(),
  updatedAt:   z.string().nullable(),
  updatedBy:   z.string().nullable(),
});
export type GlAccountAdminRow = z.infer<typeof glAccountAdminRowSchema>;

export const createGlAccountSchema = z.object({
  code:        z.string().min(1).max(50),
  name:        z.string().min(1).max(200),
  description: z.string().optional(),
  categories:  glAccountCategoriesSchema,
});
export type CreateGlAccountDto = z.infer<typeof createGlAccountSchema>;

export const updateGlAccountSchema = z
  .object({
    code:        z.string().min(1).max(50).optional(),
    name:        z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    categories:  glAccountCategoriesSchema.optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
export type UpdateGlAccountDto = z.infer<typeof updateGlAccountSchema>;
