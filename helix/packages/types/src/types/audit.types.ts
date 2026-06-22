export interface AuditEventDto {
  entityType: string;
  entityId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}
