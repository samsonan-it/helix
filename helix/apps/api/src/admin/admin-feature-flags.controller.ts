import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Role, AuthUser } from '@helix/types';
import { FeatureFlagAdminRow, ToggleFeatureFlagDto, toggleFeatureFlagSchema } from '@helix/shared';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { FlagKeys, FlagKey } from '../config/flag-keys';

@ApiTags('admin')
@ApiCookieAuth('helix-session')
@Controller('admin/feature-flags')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminFeatureFlagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags with metadata (Admin only)' })
  async listFlags(@CurrentUser() _admin: AuthUser): Promise<FeatureFlagAdminRow[]> {
    const keys = Object.values(FlagKeys) as FlagKey[];

    const rows = await this.prisma.config.findMany({
      where: { key: { in: keys } },
    });
    const rowMap = new Map(rows.map((r) => [r.key, r]));

    const updatedByIds = rows
      .map((r) => r.updatedBy)
      .filter((id): id is string => id !== null);
    const users = updatedByIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: updatedByIds } },
          select: { id: true, name: true },
        })
      : [];
    const userNameMap = new Map(users.map((u) => [u.id, u.name]));

    return keys.map((key): FeatureFlagAdminRow => {
      const row = rowMap.get(key);
      return {
        key,
        value: row?.value ?? false,
        description: row?.description ?? null,
        updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
        updatedByName: row?.updatedBy ? (userNameMap.get(row.updatedBy) ?? null) : null,
      };
    });
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Toggle a feature flag (Admin only)' })
  async toggleFlag(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(toggleFeatureFlagSchema)) dto: ToggleFeatureFlagDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<FeatureFlagAdminRow> {
    const validKeys = Object.values(FlagKeys) as string[];
    if (!validKeys.includes(key)) {
      throw new NotFoundException(`Unknown flag key: ${key}`);
    }

    const updatedRow = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.config.findUnique({ where: { key } });
      const previousValue = existing?.value ?? false;

      const row = await tx.config.upsert({
        where: { key },
        update: { value: dto.value, updatedBy: admin.id },
        create: { key, value: dto.value, updatedBy: admin.id },
      });
      // Audit log LAST per CLAUDE.md rule 8
      await tx.auditLog.create({
        data: {
          entityType: 'FeatureFlag',
          entityId:   key,
          eventType:  'FLAG_TOGGLED',
          changedBy:  admin.id,
          changedAt:  new Date(),
          before:     { value: previousValue } as Prisma.JsonObject,
          after:      { value: dto.value }     as Prisma.JsonObject,
        },
      });
      return row;
    });

    return {
      key,
      value: updatedRow.value,
      description: updatedRow.description ?? null,
      updatedAt: updatedRow.updatedAt.toISOString(),
      updatedByName: admin.name,
    };
  }
}
