import { api } from '../../../lib/api';
import { FeatureFlagAdminRow } from '@helix/shared';

export const listAdminFeatureFlags = (): Promise<FeatureFlagAdminRow[]> =>
  api.get('/admin/feature-flags').then((r) => r.data);

export const toggleAdminFeatureFlag = (key: string, value: boolean): Promise<FeatureFlagAdminRow> =>
  api.patch(`/admin/feature-flags/${key}`, { value }).then((r) => r.data);
