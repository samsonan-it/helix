import { api } from '../../../lib/api';
import { PaginatedAuditLog } from '@helix/shared';

export interface AuditLogFilters {
  entityId?: string;
  entityTypes?: string[];
  eventTypes?: string[];
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const listAdminAuditLogs = (filters: AuditLogFilters = {}): Promise<PaginatedAuditLog> => {
  const params = new URLSearchParams();
  if (filters.entityId)            params.set('entityId', filters.entityId);
  if (filters.entityTypes?.length) params.set('entityType', filters.entityTypes.join(','));
  if (filters.eventTypes?.length)  params.set('eventType', filters.eventTypes.join(','));
  if (filters.from)       params.set('from', filters.from);
  if (filters.to)         params.set('to', filters.to);
  if (filters.page)       params.set('page', String(filters.page));
  if (filters.pageSize)   params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return api.get<PaginatedAuditLog>(`/admin/audit-logs${qs ? `?${qs}` : ''}`).then((r) => r.data);
};
