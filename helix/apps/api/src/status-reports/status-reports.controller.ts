import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, Role } from '@helix/types';
import { createStatusReportSchema } from '@helix/shared';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StatusReportsService } from './status-reports.service';
import { StatusReportResponse } from './status-reports.types';

@ApiTags('status-reports')
@ApiCookieAuth('helix-session')
@UseGuards(SessionAuthGuard)
@Controller('projects/:projectId/status-reports')
export class StatusReportsController {
  constructor(private readonly service: StatusReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a status report for a project' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ): Promise<StatusReportResponse> {
    const dto = createStatusReportSchema.parse(body);
    return this.service.create(projectId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all status reports for a project' })
  findByProject(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ): Promise<StatusReportResponse[]> {
    return this.service.findByProject(projectId, user.id, user.roles as Role[]);
  }
}
