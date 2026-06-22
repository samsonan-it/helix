import { z } from 'zod';

export const personResponseSchema = z.object({
  id:    z.string(),
  email: z.string(),
  name:  z.string(),
});

export type PersonResponse = z.infer<typeof personResponseSchema>;
