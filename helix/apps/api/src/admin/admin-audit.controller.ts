import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@helix/types';
import { Prisma } from '@prisma/client';
import { PaginatedAuditLog, ListAuditLogsQuery, listAuditLogsQuerySchema } from '@helix/shared';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('admin')
@ApiCookieAuth('helix-session')
@Controller('admin/audit-logs')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit log (Admin only, paginated)' })
  async listAuditLogs(
    @Query(new ZodValidationPipe(listAuditLogsQuerySchema)) query: ListAuditLogsQuery,
  ): Promise<PaginatedAuditLog> {
    const { entityId, entityType, eventType, from, to, page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};
    if (entityId) where.entityId = entityId;
    if (entityType) {
      const types = entityType.split(',').map((t) => t.trim()).filter(Boolean);
      where.entityType = types.length === 1 ? types[0] : { in: types };
    }
    if (eventType) {
      const types = eventType.split(',').map((t) => t.trim()).filter(Boolean);
      where.eventType = types.length === 1 ? types[0] : { in: types };
    }
    if (from || to) {
      where.changedAt = {};
      if (from) where.changedAt.gte = new Date(from);
      if (to)   where.changedAt.lte = new Date(to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const actorIds = [...new Set(rows.map((r) => r.changedBy))].filter(Boolean);
    const users = actorIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true, status: true, azureAdOid: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = rows.map((row) => {
      const user = userMap.get(row.changedBy);
      let actorName: string;
      if (!user) {
        actorName = row.changedBy;
      } else if (user.status === 'retention_only') {
        actorName = `[Departed User — ID: ${user.azureAdOid ?? user.id}]`;
      } else {
        actorName = user.name;
      }

      return {
        id: row.id,
        changedAt: row.changedAt.toISOString(),
        actorName,
        actorId: row.changedBy,
        actorEmail: user?.status !== 'retention_only' ? (user?.email ?? null) : null,
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        before: row.before as Record<string, unknown> | null,
        after:  row.after  as Record<string, unknown> | null,
      };
    });

    return { data, total, page, pageSize };
  }
}
