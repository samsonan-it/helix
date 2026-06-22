import { z } from 'zod';

export interface FeatureFlagAdminRow {
  key: string;
  value: boolean;
  description: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

export const toggleFeatureFlagSchema = z.object({
  value: z.boolean(),
});
export type ToggleFeatureFlagDto = z.infer<typeof toggleFeatureFlagSchema>;
