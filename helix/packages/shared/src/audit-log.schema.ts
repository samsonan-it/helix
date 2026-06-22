import { z } from 'zod';

export interface AuditLogRow {
  id: string;
  changedAt: string;
  actorName: string;
  actorId: string;
  actorEmail: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface PaginatedAuditLog {
  data: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const listAuditLogsQuerySchema = z.object({
  entityId:   z.string().optional(),
  entityType: z.string().optional(),
  eventType:  z.string().optional(),
  from:       z.string().datetime({ offset: true }).optional(),
  to:         z.string().datetime({ offset: true }).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(200).default(50),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
