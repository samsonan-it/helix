import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { listAdminAuditLogs, AuditLogFilters } from '../api/adminAudit.api';

export function useAdminAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(filters as Record<string, unknown>),
    queryFn: () => listAdminAuditLogs(filters),
    staleTime: 0,
  });
}
