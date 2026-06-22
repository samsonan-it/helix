import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStatusReportDto } from '@helix/shared';
import { StatusReportResponse } from './status-reports.types';
import { StatusReport } from '@prisma/client';
import { Role } from '@helix/types';

@Injectable()
export class StatusReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    projectId: string,
    userId: string,
    dto: CreateStatusReportDto,
  ): Promise<StatusReportResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { assignedPmId: true, status: true },
    });

    if (!project || project.assignedPmId !== userId) {
      throw new ForbiddenException('Not your project');
    }

    if (project.status !== 'IN_EXECUTION' && project.status !== 'ASSUMED_COMPLETED') {
      throw new BadRequestException('Status reports are only available for active projects');
    }

    const submittedAt = new Date();

    const created = await this.prisma.statusReport.create({
      data: {
        projectId,
        submittedById: userId,
        submittedAt,
        overallRag:        dto.overallRag,
        scheduleRag:       dto.scheduleRag,
        resourcesRag:      dto.resourcesRag,
        budgetCurrentRag:  dto.budgetCurrentRag,
        budgetForecastRag: dto.budgetForecastRag,
        stakeholdersRag:   dto.stakeholdersRag,
        valuePropRag:      dto.valuePropRag,
        providerRag:       dto.providerRag,
        overallExplanation:        dto.overallExplanation ?? null,
        scheduleExplanation:       dto.scheduleExplanation ?? null,
        resourcesExplanation:      dto.resourcesExplanation ?? null,
        budgetCurrentExplanation:  dto.budgetCurrentExplanation ?? null,
        budgetForecastExplanation: dto.budgetForecastExplanation ?? null,
        stakeholdersExplanation:   dto.stakeholdersExplanation ?? null,
        valuePropExplanation:      dto.valuePropExplanation ?? null,
        providerExplanation:       dto.providerExplanation ?? null,
        keyAccomplishments: dto.keyAccomplishments ?? null,
        nextSteps:          dto.nextSteps ?? null,
        goLiveDate:         dto.goLiveDate ? new Date(dto.goLiveDate) : null,
      },
    });

    return this.mapToResponse(created);
  }

  async findByProject(
    projectId: string,
    userId: string,
    roles: Role[] = [],
  ): Promise<StatusReportResponse[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { assignedPmId: true, status: true },
    });

    const isPrivileged = roles.includes(Role.PortfolioManager) || roles.includes(Role.Admin);

    if (!project || (project.assignedPmId !== userId && !isPrivileged)) {
      throw new ForbiddenException('Not your project');
    }

    if (!isPrivileged && project.status !== 'IN_EXECUTION' && project.status !== 'ASSUMED_COMPLETED') {
      throw new BadRequestException('Status reports are only available for active projects');
    }

    const reports = await this.prisma.statusReport.findMany({
      where: { projectId },
      orderBy: { submittedAt: 'desc' },
    });

    return reports.map((r) => this.mapToResponse(r));
  }

  private mapToResponse(r: StatusReport): StatusReportResponse {
    return {
      id:                r.id,
      projectId:         r.projectId,
      submittedAt:       r.submittedAt.toISOString(),
      submittedById:     r.submittedById,
      overallRag:        r.overallRag,
      scheduleRag:       r.scheduleRag,
      resourcesRag:      r.resourcesRag,
      budgetCurrentRag:  r.budgetCurrentRag,
      budgetForecastRag: r.budgetForecastRag,
      stakeholdersRag:   r.stakeholdersRag,
      valuePropRag:      r.valuePropRag,
      providerRag:       r.providerRag,
      overallExplanation:        r.overallExplanation,
      scheduleExplanation:       r.scheduleExplanation,
      resourcesExplanation:      r.resourcesExplanation,
      budgetCurrentExplanation:  r.budgetCurrentExplanation,
      budgetForecastExplanation: r.budgetForecastExplanation,
      stakeholdersExplanation:   r.stakeholdersExplanation,
      valuePropExplanation:      r.valuePropExplanation,
      providerExplanation:       r.providerExplanation,
      keyAccomplishments: r.keyAccomplishments,
      nextSteps:          r.nextSteps,
      goLiveDate:         r.goLiveDate?.toISOString() ?? null,
    };
  }
}
