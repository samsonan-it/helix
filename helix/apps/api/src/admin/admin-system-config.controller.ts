import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, AuthUser } from '@helix/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../config/system-config.service';
import { SystemConfigKeys, UpdateSystemConfigDto, updateSystemConfigSchema, SystemSettingsResponse } from '@helix/shared';

@ApiTags('admin')
@ApiCookieAuth('helix-session')
@Controller('admin/system-config')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminSystemConfigController {
  constructor(
    private readonly systemConfig: SystemConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current system configuration (Admin only)' })
  async getConfig(@CurrentUser() _user: AuthUser): Promise<SystemSettingsResponse> {
    return this.systemConfig.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Update system configuration (Admin only)' })
  async updateConfig(
    @Body(new ZodValidationPipe(updateSystemConfigSchema)) dto: UpdateSystemConfigDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<SystemSettingsResponse> {
    const updates: { key: string; value: string }[] = [];
    if (dto.spThresholdEurCents  !== undefined) updates.push({ key: SystemConfigKeys.SP_THRESHOLD_EUR_CENTS,  value: String(dto.spThresholdEurCents) });
    if (dto.intakeWindowStart    !== undefined) updates.push({ key: SystemConfigKeys.INTAKE_WINDOW_START,     value: dto.intakeWindowStart  ?? 'null' });
    if (dto.intakeWindowEnd      !== undefined) updates.push({ key: SystemConfigKeys.INTAKE_WINDOW_END,       value: dto.intakeWindowEnd    ?? 'null' });
    if (dto.budgetCycleStart     !== undefined) updates.push({ key: SystemConfigKeys.BUDGET_CYCLE_START,      value: dto.budgetCycleStart   ?? 'null' });
    if (dto.budgetCycleEnd       !== undefined) updates.push({ key: SystemConfigKeys.BUDGET_CYCLE_END,        value: dto.budgetCycleEnd     ?? 'null' });
    if (dto.gxpItValidationDays  !== undefined) updates.push({ key: SystemConfigKeys.GXP_IT_VALIDATION_DAYS,  value: String(dto.gxpItValidationDays) });
    if (dto.gxpDocumentationDays !== undefined) updates.push({ key: SystemConfigKeys.GXP_DOCUMENTATION_DAYS,  value: String(dto.gxpDocumentationDays) });

    await this.prisma.$transaction(async (tx) => {
      for (const upd of updates) {
        const before = await tx.systemConfig.findUnique({ where: { key: upd.key }, select: { value: true } });
        await tx.systemConfig.upsert({
          where:  { key: upd.key },
          update: { value: upd.value, updatedBy: admin.id },
          create: { key: upd.key, value: upd.value, updatedBy: admin.id },
        });
        // Audit log is the LAST action per CLAUDE.md rule 8 — intentional (per key iteration)
        await tx.auditLog.create({
          data: {
            entityType: 'SystemConfig',
            entityId:   upd.key,
            eventType:  'CONFIG_CHANGED',
            changedBy:  admin.id,
            changedAt:  new Date(),
            before:     { value: before?.value ?? null } as never,
            after:      { value: upd.value } as never,
          },
        });
      }
    });

    this.systemConfig.invalidateCache();
    return this.systemConfig.getAll();
  }
}
