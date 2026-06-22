import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { STATUS_REPORT_EVENTS, StatusReportReminderEvent } from './status-report.events';

@Injectable()
export class StatusReportReminderService {
  private readonly logger = new Logger(StatusReportReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 0 9 * *')
  async sendMonthlyReminders(): Promise<void> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const projects = await this.prisma.project.findMany({
      where: {
        status: 'IN_EXECUTION',
        assignedPmId: { not: null },
      },
      select: {
        id: true,
        assignedPmId: true,
        lastStatusReminderSentAt: true,
        demand: { select: { title: true, publicId: true } },
        statusReports: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: { overallRag: true },
        },
      },
    });

    for (const project of projects) {
      if (
        project.lastStatusReminderSentAt &&
        project.lastStatusReminderSentAt >= monthStart
      ) {
        continue;
      }

      try {
        await this.eventEmitter.emitAsync(
          STATUS_REPORT_EVENTS.REMINDER_DUE,
          new StatusReportReminderEvent(
            project.id,
            project.assignedPmId!,
            project.demand.title,
            project.demand.publicId,
            project.statusReports[0]?.overallRag ?? null,
          ),
        );

        await this.prisma.project.update({
          where: { id: project.id },
          data: { lastStatusReminderSentAt: now },
        });
      } catch (err) {
        this.logger.error({ projectId: project.id, err }, 'Failed to send status report reminder');
      }
    }
  }
}
