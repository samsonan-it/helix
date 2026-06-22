import { Injectable } from '@nestjs/common';
import { AuditEventDto } from '@helix/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a non-Prisma side-effect event (notifications, AI calls, etc.)
   * For Prisma-managed writes, the middleware handles auditing automatically.
   */
  async logEvent(dto: AuditEventDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          eventType: dto.eventType,
          changedBy: (dto.metadata?.['changedBy'] as string) ?? 'system',
          before: dto.metadata?.['before'] as object | undefined,
          after: dto.metadata?.['after'] as object | undefined,
        },
      });
    } catch (err) {
      console.error(`[AuditLog] Failed to log event for ${dto.entityType}/${dto.entityId}`, err);
    }
  }
}
