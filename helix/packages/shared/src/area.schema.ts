import { z } from 'zod';

export const areaResponseSchema = z.object({
  id:   z.string(),
  code: z.string(),
  name: z.string(),
});

export type AreaResponse = z.infer<typeof areaResponseSchema>;

export const areaAdminRowSchema = z.object({
  id:        z.string(),
  code:      z.string(),
  name:      z.string(),
  isActive:  z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type AreaAdminRow = z.infer<typeof areaAdminRowSchema>;

export const createAreaSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
});
export type CreateAreaDto = z.infer<typeof createAreaSchema>;

export const updateAreaSchema = z
  .object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(200).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
export type UpdateAreaDto = z.infer<typeof updateAreaSchema>;
