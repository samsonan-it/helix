import { api } from '../../../lib/api';
import { SystemSettingsResponse, UpdateSystemConfigDto } from '@helix/shared';

export const getSystemConfig = (): Promise<SystemSettingsResponse> =>
  api.get('/admin/system-config').then(r => r.data);

export const updateSystemConfig = (dto: UpdateSystemConfigDto): Promise<SystemSettingsResponse> =>
  api.patch('/admin/system-config', dto).then(r => r.data);

// Public read (used by demand form for intake window check)
export const getSystemSettings = (): Promise<SystemSettingsResponse> =>
  api.get('/config/system-settings').then(r => r.data);
