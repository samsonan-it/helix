import { isAxiosError } from 'axios';
import { api } from '../../../lib/api';
import { UserAdminRow, UpdateUserRolesDto, RoutingHealthResponse, CreateUserDto, UpdateUserStatusDto } from '@helix/shared';

export async function listAdminUsers(params?: { search?: string; role?: string; costCentreId?: string; areaId?: string }): Promise<UserAdminRow[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.role) query.set('role', params.role);
  if (params?.costCentreId) query.set('costCentreId', params.costCentreId);
  if (params?.areaId) query.set('areaId', params.areaId);
  const qs = query.toString();
  const res = await api.get<UserAdminRow[]>(`/admin/users${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function createAdminUser(dto: CreateUserDto): Promise<UserAdminRow> {
  const res = await api.post<UserAdminRow>('/admin/users', dto);
  return res.data;
}

export async function updateAdminUserStatus(userId: string, dto: UpdateUserStatusDto): Promise<void> {
  await api.patch(`/admin/users/${userId}/status`, dto);
}

export async function updateUserRoles(userId: string, dto: UpdateUserRolesDto): Promise<void> {
  await api.put(`/admin/users/${userId}/roles`, dto);
}

export async function getRoutingHealth(): Promise<RoutingHealthResponse> {
  const res = await api.get<RoutingHealthResponse>('/admin/routing-health');
  return res.data;
}

export interface BulkInternalOrdersResult {
  imported: number;
  skipped: number;
  errors: { row: number; helix_project_id: string; reason: string }[];
}

export async function postBulkInternalOrders(file: File, overwrite: boolean): Promise<BulkInternalOrdersResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('overwrite', String(overwrite));
  try {
    const res = await api.post<BulkInternalOrdersResult>('/projects/bulk-internal-orders', formData);
    return res.data;
  } catch (err) {
    // NestJS wraps the 422 payload under `message`; extract it so callers get structured row errors
    if (isAxiosError(err) && err.response?.status === 422) {
      const payload = err.response.data?.message;
      if (payload && typeof payload === 'object' && Array.isArray(payload.errors)) {
        return payload as BulkInternalOrdersResult;
      }
    }
    throw err;
  }
}
