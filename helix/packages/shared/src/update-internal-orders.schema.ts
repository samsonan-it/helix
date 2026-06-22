import { z } from 'zod';

export const updateInternalOrdersSchema = z
  .object({
    opexInternalOrder:  z.string().max(50).nullable().optional(),
    capexInternalOrder: z.string().max(50).nullable().optional(),
  })
  .refine(
    (d) => d.opexInternalOrder !== undefined || d.capexInternalOrder !== undefined,
    'At least one field required',
  );

export type UpdateInternalOrdersDto = z.infer<typeof updateInternalOrdersSchema>;
