import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { Role } from '@helix/types';
import {
  DemandSubmittedEvent,
  DemandSpDmAcceptedEvent,
  DemandDmReroutedEvent,
  DemandDmRejectedEvent,
  DemandPmApprovedEvent,
  DemandPmRejectedEvent,
  DemandSpOfferSentEvent,
  DemandSpOfferAcceptedEvent,
  DemandSpOfferReworkedEvent,
  DemandBcReviewStartedEvent,
  DemandBcApprovedEvent,
  DemandBcRejectedEvent,
  DemandBcReroutedToRequesterEvent,
  DemandPmSentToRequesterEvent,
  DemandPmSentToDmEvent,
  DEMAND_EVENTS,
} from './events/demand.events';
import {
  PROJECT_EVENTS,
  ProjectAssumedCompletedEvent,
  ProjectCharterApprovedEvent,
  ProjectCharterReturnedEvent,
  ProjectCharterSubmittedEvent,
  ProjectClosureAcceptedEvent,
  ProjectClosureReturnedEvent,
  ProjectClosureSubmittedEvent,
} from '../projects/project-staleness.service';
import { STATUS_REPORT_EVENTS, StatusReportReminderEvent } from '../status-reports/status-report.events';

type DemandWithActors = {
  title: string;
  publicId: number;
  businessControllerId: string | null;
  originator: { email: string; name: string };
  demandManager: { email: string; name: string } | null;
};

@Injectable()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  private async loadDemand(demandId: string): Promise<DemandWithActors> {
    return this.prisma.demand.findUniqueOrThrow({
      where: { id: demandId },
      select: {
        title: true,
        publicId: true,
        businessControllerId: true,
        originator: { select: { email: true, name: true } },
        demandManager: { select: { email: true, name: true } },
      },
    });
  }

  private async loadUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }

  private async loadPortfolioManagerEmails(): Promise<string[]> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { role: Role.PortfolioManager },
      select: { user: { select: { email: true } } },
    });
    return assignments.map((a) => a.user.email);
  }

  private async send(
    demandId: string,
    demand: DemandWithActors,
    to: string[],
    subject: string,
    action: string,
    actorName: string,
    commentary?: string,
  ): Promise<void> {
    const titleWithId = `${demand.title} (#${demand.publicId})`;
    const deepLink = this.notificationService.buildDeepLink(demandId);
    const text = this.notificationService.buildEmailText(titleWithId, action, actorName, deepLink);
    const html = this.notificationService.buildEmailHtml(titleWithId, action, actorName, deepLink);
    await this.notificationService.sendWithRetry(demandId, {
      to,
      subject: demand.title ? subject.replace(demand.title, titleWithId) : `${subject} (#${demand.publicId})`,
      text: commentary ? `${text}\n\nReason: ${commentary}` : text,
      html: commentary ? `${html}\n<p><strong>Reason:</strong> ${commentary}</p>` : html,
    });
  }

  @OnEvent(DEMAND_EVENTS.SUBMITTED)
  async onSubmitted(event: DemandSubmittedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    if (!demand.demandManager) return;
    await this.send(
      event.demandId, demand,
      [demand.demandManager.email],
      `New demand awaiting your review: ${demand.title}`,
      'submitted a new demand',
      demand.originator.name,
    );
  }

  // DEMAND_EVENTS.ACCEPTED handler removed — dmAccept() now emits BC_REVIEW_STARTED (Story 4.11).
  // P-path PM notifications will be added in Story 4.16 (BC email notifications).

  @OnEvent(DEMAND_EVENTS.SP_DM_ACCEPTED)
  async onSpDmAccepted(event: DemandSpDmAcceptedEvent): Promise<void> {
    // SP-path: DM accepted at DM Review → DM Cost Estimation → notify Originator
    const demand = await this.loadDemand(event.demandId);
    await this.send(
      event.demandId, demand,
      [demand.originator.email],
      `Your demand has been accepted: ${demand.title}`,
      'accepted the demand and is preparing a cost estimate',
      demand.demandManager?.name ?? 'Demand Manager',
    );
  }

  @OnEvent(DEMAND_EVENTS.DM_REROUTED)
  async onDmRerouted(event: DemandDmReroutedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    await this.send(
      event.demandId, demand,
      [demand.originator.email],
      `Your demand requires rework: ${demand.title}`,
      'returned the demand for rework',
      demand.demandManager?.name ?? 'Demand Manager',
    );
  }

  @OnEvent(DEMAND_EVENTS.DM_REJECTED)
  async onDmRejected(event: DemandDmRejectedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    await this.send(
      event.demandId, demand,
      [demand.originator.email],
      `Your demand has been rejected: ${demand.title}`,
      'rejected the demand',
      demand.demandManager?.name ?? 'Demand Manager',
    );
  }

  @OnEvent(DEMAND_EVENTS.PM_APPROVED)
  async onPmApproved(event: DemandPmApprovedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    const to = [demand.originator.email];
    if (demand.demandManager) to.push(demand.demandManager.email);
    // AC-6: also notify BC if assigned
    if (demand.businessControllerId) {
      const bcEmail = await this.loadUserEmail(demand.businessControllerId);
      if (bcEmail) to.push(bcEmail);
    }
    const actorUser = await this.prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    await this.send(
      event.demandId, demand,
      to,
      `Demand approved: ${demand.title}`,
      'approved the demand',
      actorUser?.name ?? 'Portfolio Manager',
    );
  }

  @OnEvent(DEMAND_EVENTS.PM_REJECTED)
  async onPmRejected(event: DemandPmRejectedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    const to = [demand.originator.email];
    if (demand.demandManager) to.push(demand.demandManager.email);
    const actorUser = await this.prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    await this.send(
      event.demandId, demand,
      to,
      `Demand rejected: ${demand.title}`,
      'rejected the demand',
      actorUser?.name ?? 'Portfolio Manager',
    );
  }

  @OnEvent(DEMAND_EVENTS.SP_OFFER_SENT)
  async onSpOfferSent(event: DemandSpOfferSentEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    await this.send(
      event.demandId, demand,
      [demand.originator.email],
      `Cost estimate ready for your review: ${demand.title}`,
      'submitted a cost estimate for your review',
      demand.demandManager?.name ?? 'Demand Manager',
    );
  }

  @OnEvent(DEMAND_EVENTS.SP_OFFER_ACCEPTED)
  async onSpOfferAccepted(event: DemandSpOfferAcceptedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    const pmEmails = await this.loadPortfolioManagerEmails();
    if (!pmEmails.length) return;
    await this.send(
      event.demandId, demand,
      pmEmails,
      `SP demand awaiting your approval: ${demand.title}`,
      'accepted the cost estimate offer',
      demand.originator.name,
    );
  }

  @OnEvent(DEMAND_EVENTS.SP_OFFER_REWORKED)
  async onSpOfferReworked(event: DemandSpOfferReworkedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    if (!demand.demandManager) return;
    await this.send(
      event.demandId, demand,
      [demand.demandManager.email],
      `Cost estimate revision requested: ${demand.title}`,
      'requested revisions to the cost estimate',
      demand.originator.name,
    );
  }

  // Story 4.16 — BC workflow notification handlers

  @OnEvent(DEMAND_EVENTS.BC_REVIEW_STARTED)
  async onBcReviewStarted(event: DemandBcReviewStartedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    if (!demand.businessControllerId) return;
    const bcEmail = await this.loadUserEmail(demand.businessControllerId);
    if (!bcEmail) return;
    await this.send(
      event.demandId, demand,
      [bcEmail],
      `New demand awaiting your review: ${demand.title}`,
      'submitted a demand for BC review',
      demand.demandManager?.name ?? 'Demand Manager',
    );
  }

  @OnEvent(DEMAND_EVENTS.BC_APPROVED)
  async onBcApproved(event: DemandBcApprovedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    const pmEmails = await this.loadPortfolioManagerEmails();
    if (!pmEmails.length) return;
    const bcUser = await this.prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    await this.send(
      event.demandId, demand,
      pmEmails,
      `Demand awaiting your approval: ${demand.title}`,
      'approved the BC review',
      bcUser?.name ?? 'Business Controller',
    );
  }

  @OnEvent(DEMAND_EVENTS.BC_REJECTED)
  async onBcRejected(event: DemandBcRejectedEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    const to = [demand.originator.email];
    if (demand.demandManager) to.push(demand.demandManager.email);
    const bcUser = await this.prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    await this.send(
      event.demandId, demand,
      to,
      `Demand rejected: ${demand.title}`,
      'rejected the demand at BC review',
      bcUser?.name ?? 'Business Controller',
      event.commentary,
    );
  }

  @OnEvent(DEMAND_EVENTS.BC_REROUTED_TO_REQUESTER)
  async onBcReroutedToRequester(event: DemandBcReroutedToRequesterEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    const bcUser = await this.prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    await this.send(
      event.demandId, demand,
      [demand.originator.email],
      `Your demand requires rework: ${demand.title}`,
      'returned the demand for rework',
      bcUser?.name ?? 'Business Controller',
      event.commentary,
    );
  }

  @OnEvent(DEMAND_EVENTS.PM_SENT_TO_REQUESTER)
  async onPmSentToRequester(event: DemandPmSentToRequesterEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    const pmUser = await this.prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    await this.send(
      event.demandId, demand,
      [demand.originator.email],
      `Your demand requires revision: ${demand.title}`,
      'sent the demand back for revision',
      pmUser?.name ?? 'Portfolio Manager',
      event.commentary,
    );
  }

  @OnEvent(DEMAND_EVENTS.PM_SENT_TO_DM)
  async onPmSentToDm(event: DemandPmSentToDmEvent): Promise<void> {
    const demand = await this.loadDemand(event.demandId);
    if (!demand.demandManager) return;
    const pmUser = await this.prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    await this.send(
      event.demandId, demand,
      [demand.demandManager.email],
      `A demand has been returned to you: ${demand.title}`,
      'returned the demand to the demand manager',
      pmUser?.name ?? 'Portfolio Manager',
      event.commentary,
    );
  }

  @OnEvent(PROJECT_EVENTS.ASSUMED_COMPLETED)
  async onProjectAssumedCompleted(event: ProjectAssumedCompletedEvent): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: event.projectId },
      select: {
        id: true,
        demand: { select: { title: true, publicId: true } },
        assignedPm: { select: { email: true, name: true } },
      },
    });
    if (!project) return;

    const adminAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { role: Role.Admin },
      select: { user: { select: { email: true } } },
    });
    const adminEmails = adminAssignments.map((a) => a.user.email);

    const to: string[] = [...new Set([
      ...adminEmails,
      ...(project.assignedPm?.email ? [project.assignedPm.email] : []),
    ])];
    if (!to.length) return;

    const titleWithId = `${project.demand.title} (#${project.demand.publicId})`;
    const text = `Project "${titleWithId}" has been automatically flagged as Needs Review because its end date has passed with no closure initiated. Please review and take action.`;
    const html = `<p>Project <strong>${titleWithId}</strong> has been automatically flagged as <strong>Needs Review</strong> because its end date has passed with no closure initiated.</p><p>Please review and take action in Helix.</p>`;

    try {
      await this.notificationService.sendWithRetry(event.projectId, {
        to,
        subject: `Project flagged as Needs Review: ${titleWithId}`,
        text,
        html,
      });
    } catch (err) {
      this.logger.error({ projectId: event.projectId, err }, 'Failed to send ASSUMED_COMPLETED notification');
    }
  }

  @OnEvent(PROJECT_EVENTS.CLOSURE_SUBMITTED)
  async onProjectClosureSubmitted(event: ProjectClosureSubmittedEvent): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: event.projectId },
      select: { demand: { select: { title: true, publicId: true } } },
    });
    if (!project?.demand) return;

    const ppmEmails = await this.loadPortfolioManagerEmails();
    if (!ppmEmails.length) {
      this.logger.warn({ projectId: event.projectId }, 'No PPM users found for closure notification');
      return;
    }
    const actor = await this.prisma.user.findUnique({ where: { id: event.actorId }, select: { name: true } });
    const titleWithId = `${project.demand.title} (#${project.demand.publicId})`;
    const link = this.notificationService.buildProjectDeepLink(event.projectId);
    await this.notificationService.sendWithRetry(event.projectId, {
      to: ppmEmails,
      subject: `Project closure submitted for review: ${titleWithId}`,
      html: this.notificationService.buildEmailHtml(titleWithId, 'submitted closure for review', actor?.name ?? 'Project Manager', link),
      text: this.notificationService.buildEmailText(titleWithId, 'submitted closure for review', actor?.name ?? 'Project Manager', link),
    });
  }

  @OnEvent(PROJECT_EVENTS.CHARTER_SUBMITTED)
  async onProjectCharterSubmitted(event: ProjectCharterSubmittedEvent): Promise<void> {
    const ppmEmails = await this.loadPortfolioManagerEmails();
    if (ppmEmails.length === 0) {
      this.logger.warn({ projectId: event.projectId }, 'No PPM users found for charter-submitted notification');
      return;
    }
    const pm = await this.prisma.user.findUnique({
      where: { id: event.pmId },
      select: { name: true },
    });
    const actorName = pm?.name ?? 'A Project Manager';
    const link = this.notificationService.buildProjectDeepLink(event.projectId);
    await this.notificationService.sendWithRetry(event.projectId, {
      to: ppmEmails,
      subject: `Charter submitted for review: ${event.projectTitle}`,
      html: this.notificationService.buildEmailHtml(event.projectTitle, 'submitted project charter for approval', actorName, link),
      text: this.notificationService.buildEmailText(event.projectTitle, 'submitted project charter for approval', actorName, link),
    });
  }

  @OnEvent(PROJECT_EVENTS.CLOSURE_ACCEPTED)
  async onProjectClosureAccepted(event: ProjectClosureAcceptedEvent): Promise<void> {
    if (!event.assignedPmId) return;
    const pm = await this.prisma.user.findUnique({
      where: { id: event.assignedPmId },
      select: { email: true },
    });
    if (!pm?.email) return;
    const link = this.notificationService.buildProjectDeepLink(event.projectId);
    const actorUser = await this.prisma.user.findUnique({
      where: { id: event.ppmId },
      select: { name: true },
    });
    const actorName = actorUser?.name ?? 'Portfolio Manager';
    await this.notificationService.sendWithRetry(event.projectId, {
      to: [pm.email],
      subject: `Project closure accepted — completed: ${event.projectTitle}`,
      html: this.notificationService.buildEmailHtml(event.projectTitle, 'accepted the project closure — the project is now Completed', actorName, link),
      text: this.notificationService.buildEmailText(event.projectTitle, 'accepted the project closure — the project is now Completed', actorName, link),
    });
  }

  @OnEvent(PROJECT_EVENTS.CHARTER_APPROVED)
  async onProjectCharterApproved(event: ProjectCharterApprovedEvent): Promise<void> {
    if (!event.assignedPmId) return;
    const pm = await this.prisma.user.findUnique({
      where: { id: event.assignedPmId },
      select: { email: true },
    });
    if (!pm?.email) return;
    const link = this.notificationService.buildProjectDeepLink(event.projectId);
    const actorUser = await this.prisma.user.findUnique({
      where: { id: event.ppmId },
      select: { name: true },
    });
    const actorName = actorUser?.name ?? 'Portfolio Manager';
    await this.notificationService.sendWithRetry(event.projectId, {
      to: [pm.email],
      subject: `Charter approved — project started: ${event.projectTitle}`,
      html: this.notificationService.buildEmailHtml(event.projectTitle, 'approved your project charter — the project is now in execution', actorName, link),
      text: this.notificationService.buildEmailText(event.projectTitle, 'approved your project charter — the project is now in execution', actorName, link),
    });
  }

  @OnEvent(PROJECT_EVENTS.CHARTER_RETURNED)
  async onProjectCharterReturned(event: ProjectCharterReturnedEvent): Promise<void> {
    if (!event.assignedPmId) return;
    const pm = await this.prisma.user.findUnique({
      where: { id: event.assignedPmId },
      select: { email: true },
    });
    if (!pm?.email) return;
    const link = this.notificationService.buildProjectDeepLink(event.projectId);
    const actorUser = await this.prisma.user.findUnique({
      where: { id: event.ppmId },
      select: { name: true },
    });
    const actorName = actorUser?.name ?? 'Portfolio Manager';
    const safeComment = event.comment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const html = `${this.notificationService.buildEmailHtml(event.projectTitle, 'returned your project charter for rework', actorName, link)}\n<p><strong>Reason:</strong> ${safeComment}</p>`;
    const text = `${this.notificationService.buildEmailText(event.projectTitle, 'returned your project charter for rework', actorName, link)}\n\nReason: ${event.comment}`;
    await this.notificationService.sendWithRetry(event.projectId, {
      to: [pm.email],
      subject: `Charter returned for rework: ${event.projectTitle}`,
      html,
      text,
    });
  }

  @OnEvent(PROJECT_EVENTS.CLOSURE_RETURNED)
  async onProjectClosureReturned(event: ProjectClosureReturnedEvent): Promise<void> {
    if (!event.assignedPmId) return;
    const pm = await this.prisma.user.findUnique({
      where: { id: event.assignedPmId },
      select: { email: true },
    });
    if (!pm?.email) return;
    const link = this.notificationService.buildProjectDeepLink(event.projectId);
    const actorUser = await this.prisma.user.findUnique({
      where: { id: event.ppmId },
      select: { name: true },
    });
    const actorName = actorUser?.name ?? 'Portfolio Manager';
    const safeComment = event.comment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const html = `${this.notificationService.buildEmailHtml(event.projectTitle, 'returned the closure submission for rework', actorName, link)}\n<p><strong>Reason:</strong> ${safeComment}</p>`;
    const text = `${this.notificationService.buildEmailText(event.projectTitle, 'returned the closure submission for rework', actorName, link)}\n\nReason: ${event.comment}`;
    await this.notificationService.sendWithRetry(event.projectId, {
      to: [pm.email],
      subject: `Closure returned for rework: ${event.projectTitle}`,
      html,
      text,
    });
  }

  @OnEvent(STATUS_REPORT_EVENTS.REMINDER_DUE)
  async onStatusReportReminderDue(event: StatusReportReminderEvent): Promise<void> {
    const pmEmail = await this.loadUserEmail(event.pmId);
    if (!pmEmail) return;

    const prevRagText = event.prevOverallRag
      ? `Last submission: ${event.prevOverallRag.charAt(0) + event.prevOverallRag.slice(1).toLowerCase()}`
      : 'No previous submission';

    const titleWithId = `${event.projectTitle} (#${event.publicId})`;
    const titleWithIdHtml = titleWithId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const link = this.notificationService.buildStatusReportDeepLink(event.projectId);
    const text = `Monthly status report reminder for project "${titleWithId}".\n${prevRagText}\n\nSubmit your status report: ${link}`;
    const html = `<p>Monthly status report reminder for project <strong>${titleWithIdHtml}</strong>.</p><p>${prevRagText}</p><p><a href="${link}">Submit status report →</a></p>`;

    await this.notificationService.sendWithRetry(event.projectId, {
      to: [pmEmail],
      subject: `Status report due: ${titleWithId}`,
      text,
      html,
    });
  }
}
