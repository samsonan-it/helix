import { z } from 'zod';

export const costCentreResponseSchema = z.object({
  id:       z.string(),
  code:     z.string(),
  name:     z.string(),
  isActive: z.boolean(),
});

export type CostCentreResponse = z.infer<typeof costCentreResponseSchema>;

export const costCentreAdminRowSchema = z.object({
  id:        z.string(),
  code:      z.string(),
  name:      z.string(),
  isActive:  z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type CostCentreAdminRow = z.infer<typeof costCentreAdminRowSchema>;

export const createCostCentreSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
});
export type CreateCostCentreDto = z.infer<typeof createCostCentreSchema>;

export const updateCostCentreSchema = z
  .object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(200).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
export type UpdateCostCentreDto = z.infer<typeof updateCostCentreSchema>;

export const deactivationBlockerSchema = z.object({
  id:     z.string(),
  title:  z.string(),
  status: z.string(),
});
export const deactivationBlockedResponseSchema = z.object({
  blockers: z.array(deactivationBlockerSchema),
});
export type DeactivationBlockedResponse = z.infer<typeof deactivationBlockedResponseSchema>;
