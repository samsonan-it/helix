import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

export const PROJECT_EVENTS = {
  ASSUMED_COMPLETED:  'project.assumed_completed',
  CHARTER_SUBMITTED:  'project.charter_submitted',
  CHARTER_APPROVED:   'project.charter_approved',
  CHARTER_RETURNED:   'project.charter_returned',
  CLOSURE_SUBMITTED:  'project.closure_submitted',
  CLOSURE_ACCEPTED:   'project.closure_accepted',
  CLOSURE_RETURNED:   'project.closure_returned',
} as const;

export class ProjectAssumedCompletedEvent {
  constructor(
    public readonly projectId: string,
    public readonly assignedPmId: string | null,
  ) {}
}

export class ProjectCharterSubmittedEvent {
  constructor(
    public readonly projectId: string,
    public readonly pmId: string,
    public readonly projectTitle: string,
  ) {}
}

export class ProjectCharterApprovedEvent {
  constructor(
    public readonly projectId: string,
    public readonly ppmId: string,
    public readonly projectTitle: string,
    public readonly assignedPmId: string | null,
  ) {}
}

export class ProjectCharterReturnedEvent {
  constructor(
    public readonly projectId: string,
    public readonly ppmId: string,
    public readonly projectTitle: string,
    public readonly assignedPmId: string | null,
    public readonly comment: string,
  ) {}
}

export class ProjectClosureSubmittedEvent {
  constructor(
    public readonly projectId: string,
    public readonly actorId: string,
  ) {}
}

export class ProjectClosureAcceptedEvent {
  constructor(
    public readonly projectId: string,
    public readonly ppmId: string,
    public readonly projectTitle: string,
    public readonly assignedPmId: string | null,
  ) {}
}

export class ProjectClosureReturnedEvent {
  constructor(
    public readonly projectId: string,
    public readonly ppmId: string,
    public readonly projectTitle: string,
    public readonly assignedPmId: string | null,
    public readonly comment: string,
  ) {}
}

@Injectable()
export class ProjectStalenessService {
  private readonly logger = new Logger(ProjectStalenessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkAssumedCompleted(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.project.findMany({
      where: {
        status: 'IN_EXECUTION',
        demand: { endDate: { lt: now, not: null } },
      },
      select: { id: true, assignedPmId: true, demandId: true },
    });

    for (const project of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.project.update({
            where: { id: project.id },
            data: { status: 'ASSUMED_COMPLETED' },
          });
          await tx.auditLog.create({
            data: {
              entityType: 'Project',
              entityId: project.id,
              eventType: 'PROJECT_ASSUMED_COMPLETED',
              changedBy: 'system',
              before: { status: 'IN_EXECUTION' },
              after: { status: 'ASSUMED_COMPLETED' },
            },
          });
        });
        this.eventEmitter.emit(
          PROJECT_EVENTS.ASSUMED_COMPLETED,
          new ProjectAssumedCompletedEvent(project.id, project.assignedPmId),
        );
        this.logger.log(`Project ${project.id} transitioned to ASSUMED_COMPLETED`);
      } catch (err) {
        this.logger.error({ projectId: project.id, err }, 'Failed to transition project to ASSUMED_COMPLETED');
      }
    }
  }
}
