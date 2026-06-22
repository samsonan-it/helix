import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import {
  BcQueueItem,
  BcRejectDto,
  BcSendToRequesterDto,
  CreateDemandDto,
  UpdateDraftDemandDto,
  DemandResponse,
  DashboardStatsResponse,
  DemandStatus,
  DmQueueItem,
  PmQueueItem,
  UnifiedQueueItem,
  DemandHistoryItem,
  DmAcceptDto,
  DmReturnDto,
  DmRejectDto,
  DmPostponeDto,
  PmApproveDto,
  PmRejectDto,
  PmSendBackDto,
  SpStep,
  SpReworkOfferDto,
  UpdateDemandDatesDto,
  SaveDmAssessmentDraftDto,
} from '@helix/shared';
import { Role } from '@helix/types';
import { DemandWorkflowService } from './demand-workflow.service';
import { SystemConfigService } from '../config/system-config.service';
import { withDemandLock } from '../common/utils/pessimistic-lock.util';
import {
  DEMAND_EVENTS,
  DemandBcReviewStartedEvent,
  DemandBcApprovedEvent,
  DemandBcRejectedEvent,
  DemandBcReroutedToRequesterEvent,
  DemandDmRejectedEvent,
  DemandDmReroutedEvent,
  DemandPmApprovedEvent,
  DemandPmRejectedEvent,
  DemandPmSentToRequesterEvent,
  DemandPmSentToDmEvent,
  DemandSubmittedEvent,
  DemandSpDmAcceptedEvent,
  DemandSpOfferSentEvent,
  DemandSpOfferAcceptedEvent,
  DemandSpOfferReworkedEvent,
  DemandTypeSwitchedEvent,
} from '../notifications/events/demand.events';
import { FlagService } from '../config/flag.service';

// Stall threshold: demands SUBMITTED for more than this many days are flagged overdue.
// Configured as feature flag dm_stall_threshold_days — numeric config deferred to future story.
const DM_STALL_THRESHOLD_DAYS = 7;

function isInvalidDateRange(startDate?: string | null, endDate?: string | null): boolean {
  if (!startDate || !endDate) return false;
  return new Date(endDate) < new Date(startDate);
}

function isFkViolation(e: unknown): boolean {
  return e instanceof PrismaClientKnownRequestError && e.code === 'P2003';
}

@Injectable()
export class DemandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: DemandWorkflowService,
    private readonly eventEmitter: EventEmitter2,
    private readonly systemConfig: SystemConfigService,
    private readonly flagService: FlagService,
  ) {}

  async createDraft(dto: CreateDemandDto, originatorId: string): Promise<DemandResponse> {
    if (isInvalidDateRange(dto.startDate, dto.endDate)) {
      throw new BadRequestException('End date cannot be before start date');
    }
    try {
      const demand = await this.prisma.$transaction(async (tx) => {
        const created = await tx.demand.create({
          data: {
            title: dto.title,
            description: dto.description,
            costCentreId: dto.costCentreId ?? null,
            glAccountId: dto.glAccountId ?? null,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            status: DemandStatus.DRAFT,
            originatorId,
            draftSavedAt: new Date(),
            legalEntityId: dto.legalEntityId ?? null,
            areaId: dto.areaId ?? null,
            demandManagerId: dto.demandManagerId ?? null,
            demandOwner: dto.demandOwner ?? null,
            objective: dto.objective ?? null,
            necessity: dto.necessity ?? null,
            isMandatory: dto.isMandatory ?? false,
            qualitativeValueCategory: dto.qualitativeValueCategory ?? null,
            quantitativeValueCategory: dto.quantitativeValueCategory ?? null,
            reasoningForMandatory: dto.reasoningForMandatory ?? null,
            asisDescription: dto.asisDescription ?? null,
            benefitsObjectives: dto.benefitsObjectives ?? null,
            tobeDescription: dto.tobeDescription ?? null,
            isSmallProject: dto.isSmallProject ?? false,
            isGxpRelevant: dto.isGxpRelevant ?? false,
            businessControllerId: dto.businessControllerId ?? null,
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'Demand',
            entityId: created.id,
            eventType: 'DRAFT_CREATED',
            changedBy: originatorId,
            before: Prisma.JsonNull,
            after: { status: DemandStatus.DRAFT, title: dto.title },
          },
        });
        return created;
      });
      return this.toResponse(demand);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (isFkViolation(e)) throw new UnprocessableEntityException('Invalid reference data');
      throw e;
    }
  }

  async updateDraft(
    id: string,
    dto: UpdateDraftDemandDto,
    requesterId: string,
  ): Promise<DemandResponse> {
    if (isInvalidDateRange(dto.startDate, dto.endDate)) {
      throw new BadRequestException('End date cannot be before start date');
    }
    try {
      const demand = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.demand.findUniqueOrThrow({ where: { id } });
        if (existing.originatorId !== requesterId) throw new ForbiddenException();

        // updateMany with status guard in WHERE makes the status check atomic
        const result = await tx.demand.updateMany({
          where: { id, status: { in: [DemandStatus.DRAFT, DemandStatus.REROUTED] } },
          data: {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.costCentreId !== undefined && { costCentreId: dto.costCentreId }),
            ...(dto.glAccountId !== undefined && { glAccountId: dto.glAccountId }),
            ...(dto.startDate !== undefined && {
              startDate: dto.startDate ? new Date(dto.startDate) : null,
            }),
            ...(dto.endDate !== undefined && {
              endDate: dto.endDate ? new Date(dto.endDate) : null,
            }),
            ...(dto.legalEntityId !== undefined && { legalEntityId: dto.legalEntityId }),
            ...(dto.areaId !== undefined && { areaId: dto.areaId }),
            ...(dto.demandManagerId !== undefined && { demandManagerId: dto.demandManagerId }),
            ...(dto.demandOwner !== undefined && { demandOwner: dto.demandOwner }),
            ...(dto.objective !== undefined && { objective: dto.objective }),
            ...(dto.necessity !== undefined && { necessity: dto.necessity }),
            ...(dto.isMandatory !== undefined && { isMandatory: dto.isMandatory }),
            ...(dto.qualitativeValueCategory !== undefined && { qualitativeValueCategory: dto.qualitativeValueCategory }),
            ...(dto.quantitativeValueCategory !== undefined && { quantitativeValueCategory: dto.quantitativeValueCategory }),
            ...(dto.reasoningForMandatory !== undefined && { reasoningForMandatory: dto.reasoningForMandatory }),
            ...(dto.asisDescription !== undefined && { asisDescription: dto.asisDescription }),
            ...(dto.benefitsObjectives !== undefined && { benefitsObjectives: dto.benefitsObjectives }),
            ...(dto.tobeDescription !== undefined && { tobeDescription: dto.tobeDescription }),
            ...(dto.isSmallProject !== undefined && { isSmallProject: dto.isSmallProject }),
            ...(dto.isGxpRelevant !== undefined && { isGxpRelevant: dto.isGxpRelevant }),
            ...(dto.businessControllerId !== undefined && { businessControllerId: dto.businessControllerId }),
            ...(dto.demandScope !== undefined && { demandScope: dto.demandScope }),
            ...(dto.countryId !== undefined && { countryId: dto.countryId }),
            draftSavedAt: new Date(),
          },
        });
        if (result.count === 0) {
          throw new BadRequestException('Only DRAFT or REROUTED demands can be updated via this endpoint');
        }

        const updated = await tx.demand.findUniqueOrThrow({ where: { id } });
        await tx.auditLog.create({
          data: {
            entityType: 'Demand',
            entityId: id,
            eventType: 'DRAFT_UPDATED',
            changedBy: requesterId,
            before: { status: existing.status },
            after: dto,
          },
        });
        return updated;
      });
      return this.toResponse(demand);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Demand ${id} not found`);
      }
      if (isFkViolation(e)) throw new UnprocessableEntityException('Invalid reference data');
      throw e;
    }
  }

  // AC-1, AC-9, AC-10, AC-11 — DM updates start/end dates on SUBMITTED or REROUTED demand.
  // No withDemandLock() — field update, not a status transition; last-write-wins is acceptable.
  async updateDemandDates(id: string, dto: UpdateDemandDatesDto, dmId: string): Promise<DemandResponse> {
    const demand = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.demand.findUniqueOrThrow({ where: { id } });

      if (existing.demandManagerId !== dmId) throw new ForbiddenException();

      const allowedStatuses = [DemandStatus.SUBMITTED, DemandStatus.REROUTED];
      if (!allowedStatuses.includes(existing.status as DemandStatus)) {
        throw new BadRequestException('Demand dates can only be updated during DM review (SUBMITTED or REROUTED)');
      }

      const updated = await tx.demand.update({
        where: { id },
        data: {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate:   dto.endDate   ? new Date(dto.endDate)   : null,
        },
      });

      // Rule 8: auditLog.create MUST be last in the transaction
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId:   id,
          eventType:  'DM_DATES_UPDATED',
          changedBy:  dmId,
          before: { startDate: existing.startDate?.toISOString() ?? null, endDate: existing.endDate?.toISOString() ?? null },
          after:  { startDate: dto.startDate ? new Date(dto.startDate).toISOString() : null, endDate: dto.endDate ? new Date(dto.endDate).toISOString() : null },
        },
      });
      return updated;
    });
    return this.toResponse(demand);
  }

  async saveDmAssessmentDraft(id: string, dmId: string, dto: SaveDmAssessmentDraftDto): Promise<DemandResponse> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.demand.findUniqueOrThrow({ where: { id } });

      await this.validateDmScope(existing.areaId, existing.countryId ?? null, dmId, tx);

      const allowedStatuses = [
        DemandStatus.SUBMITTED,
        DemandStatus.BC_REVIEW,
        DemandStatus.REROUTED,
        DemandStatus.ON_HOLD,
      ];
      if (!allowedStatuses.includes(existing.status as DemandStatus)) {
        throw new BadRequestException('Assessment draft can only be saved during DM review');
      }

      return tx.demand.update({
        where: { id },
        data: {
          ...(dto.eaInvolved         !== undefined && { eaInvolved:         dto.eaInvolved }),
          ...(dto.eaComment          !== undefined && { eaComment:          dto.eaComment?.trim() || null }),
          ...(dto.itSecurityInvolved !== undefined && { itSecurityInvolved: dto.itSecurityInvolved }),
          ...(dto.itSecurityComment  !== undefined && { itSecurityComment:  dto.itSecurityComment?.trim() || null }),
          ...(dto.itOpsInvolved      !== undefined && { itOpsInvolved:      dto.itOpsInvolved }),
          ...(dto.itOpsComment       !== undefined && { itOpsComment:       dto.itOpsComment?.trim() || null }),
        },
      });
    });
    return this.toResponse(updated);
  }

  async submitDemand(id: string, requesterId: string): Promise<DemandResponse> {
    try {
      // Fetch config OUTSIDE the lock (SystemConfigService.getAll() must not run inside $transaction)
      const cfg = await this.systemConfig.getAll();

      // Intake window check — null dates = always open (AC7)
      if (cfg.intakeWindowStart !== null || cfg.intakeWindowEnd !== null) {
        const now = new Date();
        const windowStart = cfg.intakeWindowStart ? new Date(cfg.intakeWindowStart) : null;
        const windowEnd   = cfg.intakeWindowEnd   ? new Date(cfg.intakeWindowEnd)   : null;
        const isBeforeOpen = windowStart && now < windowStart;
        const isAfterClose = windowEnd   && now > windowEnd;
        if (isBeforeOpen || isAfterClose) {
          throw new UnprocessableEntityException({
            code: 'INTAKE_CLOSED',
            opensAt: (isBeforeOpen && windowStart) ? windowStart.toISOString() : null,
          });
        }
      }

      const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
        const existing = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });

        if (existing.originatorId !== requesterId) throw new ForbiddenException();

        if (!existing.areaId) {
          throw new UnprocessableEntityException({ code: 'NO_AREA_CONFIGURED', message: 'Demand has no area — cannot route to a Demand Manager' });
        }

        // Find DM by multi-area + country scope (FR15 — blocks submission if missing)
        const [dmAssignment, areaRecord] = await Promise.all([
          tx.userRoleAssignment.findFirst({
            where: {
              role: 'DemandManager',
              user: { status: 'active' },
              OR: [
                { areaIds: { isEmpty: true } },
                {
                  areaIds: { has: existing.areaId },
                  OR: existing.countryId
                    ? [{ countryIds: { isEmpty: true } }, { countryIds: { has: existing.countryId } }]
                    : [{ countryIds: { isEmpty: true } }],
                },
              ],
            },
            select: { userId: true },
          }),
          tx.smallProjectArea.findUnique({ where: { id: existing.areaId }, select: { name: true } }),
        ]);
        if (!dmAssignment) {
          throw new UnprocessableEntityException({
            code: 'NO_DM_CONFIGURED',
            message: `No Demand Manager configured for area ${areaRecord?.name ?? existing.areaId}. Your draft has been saved. Contact your administrator.`,
          });
        }

        // Find BC by multi-area + country scope (non-blocking — AC-5)
        const bcAssignment = await tx.userRoleAssignment.findFirst({
          where: {
            role: 'BusinessController',
            user: { status: 'active' },
            OR: [
              { areaIds: { isEmpty: true } },
              {
                areaIds: { has: existing.areaId },
                OR: existing.countryId
                  ? [{ countryIds: { isEmpty: true } }, { countryIds: { has: existing.countryId } }]
                  : [{ countryIds: { isEmpty: true } }],
              },
            ],
          },
          select: { userId: true },
        });

        const isSmallProject = existing.isSmallProject ?? false;

        await this.workflowService.transition(tx, existing, DemandStatus.SUBMITTED, requesterId);

        const submittedAt = new Date();
        const result = await tx.demand.updateMany({
          where: { id, status: { in: [DemandStatus.DRAFT, DemandStatus.REROUTED] } },
          data: {
            status: DemandStatus.SUBMITTED,
            submittedAt,
            statusChangedAt: submittedAt,
            startDate: existing.startDate ?? submittedAt,
            isSmallProject,
            demandManagerId: dmAssignment.userId,
            businessControllerId: existing.businessControllerId ?? bcAssignment?.userId ?? null,
          },
        });
        if (result.count === 0) {
          throw new BadRequestException('Only DRAFT or REROUTED demands can be submitted');
        }

        // Create GxP milestones if applicable (AC3)
        if (existing.isGxpRelevant) {
          await tx.demandMilestone.createMany({
            data: [
              { demandId: id, milestoneType: 'IT_VALIDATION',  durationDays: cfg.gxpItValidationDays },
              { demandId: id, milestoneType: 'DOCUMENTATION',  durationDays: cfg.gxpDocumentationDays },
            ],
            skipDuplicates: true,
          });
        }

        const updated = await tx.demand.findUniqueOrThrow({ where: { id } });

        await tx.auditLog.create({
          data: {
            entityType: 'Demand',
            entityId: id,
            eventType: 'DEMAND_SUBMITTED',
            changedBy: requesterId,
            before: { status: existing.status },
            after: { status: DemandStatus.SUBMITTED, isSmallProject },
          },
        });

        return updated;
      });
      this.eventEmitter.emit(DEMAND_EVENTS.SUBMITTED, new DemandSubmittedEvent(id, requesterId));
      return this.toResponse(demand);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw e;
    }
  }

  async findOne(id: string, requesterId: string, requesterRoles: string[]): Promise<DemandResponse> {
    const demand = await this.prisma.demand
      .findUniqueOrThrow({
        where: { id },
        include: {
          project: { select: { id: true } },
          costCentre: { select: { code: true, name: true } },
          legalEntity: { select: { code: true, name: true } },
          area: { select: { code: true, name: true } },
          country: { select: { id: true, code: true, name: true } },
        },
      })
      .catch(() => { throw new NotFoundException(`Demand ${id} not found`); });

    const canViewAll =
      requesterRoles.includes(Role.DemandManager) ||
      requesterRoles.includes(Role.PortfolioManager) ||
      requesterRoles.includes(Role.BusinessController);
    // Return 404 for non-owners to avoid leaking demand existence
    if (!canViewAll && demand.originatorId !== requesterId) {
      throw new NotFoundException(`Demand ${id} not found`);
    }

    return this.toResponse(demand, demand.project?.id ?? null);
  }

  async findAll(requesterId: string, requesterRoles: string[], filters: { publicId?: number } = {}): Promise<DemandResponse[]> {
    const canViewAll =
      requesterRoles.includes(Role.DemandManager) ||
      requesterRoles.includes(Role.PortfolioManager);

    const baseWhere = canViewAll ? undefined : { originatorId: requesterId };
    const where = filters.publicId !== undefined
      ? { ...baseWhere, publicId: filters.publicId }
      : baseWhere;

    const demands = await this.prisma.demand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        costCentre: { select: { code: true, name: true } },
        legalEntity: { select: { code: true, name: true } },
        area: { select: { code: true, name: true } },
        country: { select: { id: true, code: true, name: true } },
      },
    });
    return demands.map((d) => this.toResponse(d));
  }

  // ── DM Queue ──────────────────────────────────────────────────────────────

  async getDmQueue(
    dmId: string,
    filters: { status?: string; search?: string; stalledOnly?: boolean } = {},
  ): Promise<DmQueueItem[]> {
    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: { userId: dmId, role: Role.DemandManager },
      select: { areaIds: true, countryIds: true },
    });
    if (!assignment) return [];

    const { areaIds, countryIds } = assignment;

    // Global DM (empty areaIds) sees all demands — no area/country filter
    const areaFilter = areaIds.length > 0 ? { areaId: { in: areaIds } } : {};
    const countryFilter = areaIds.length > 0 && countryIds.length > 0 ? { countryId: { in: countryIds } } : {};

    const validStatuses = Object.values(DemandStatus) as string[];
    const statusFilter =
      filters.status && validStatuses.includes(filters.status)
        ? (filters.status as DemandStatus)
        : undefined;

    const stallCutoff = filters.stalledOnly
      ? new Date(Date.now() - DM_STALL_THRESHOLD_DAYS * 86_400_000)
      : undefined;

    // AC-9: when filtering by SUBMITTED, also include REROUTED SP demands at DM_COST_ESTIMATION
    const statusWhere =
      statusFilter === DemandStatus.SUBMITTED
        ? {
            OR: [
              { status: DemandStatus.SUBMITTED },
              { status: DemandStatus.REROUTED, isSmallProject: true, spStep: SpStep.DM_COST_ESTIMATION },
            ],
          }
        : statusFilter
          ? { status: statusFilter }
          : {};

    const demands = await this.prisma.demand.findMany({
      where: {
        ...areaFilter,
        ...countryFilter,
        ...statusWhere,
        ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
        ...(stallCutoff
          ? {
              OR: [
                { statusChangedAt: { lte: stallCutoff } },
                { statusChangedAt: null, updatedAt: { lte: stallCutoff } },
              ],
            }
          : {}),
      },
      orderBy: { submittedAt: 'asc' },
      select: { id: true, publicId: true, title: true, status: true, areaId: true, updatedAt: true, statusChangedAt: true, spStep: true, isSmallProject: true,
        originator:    { select: { name: true } },
        demandManager: { select: { name: true } },
      },
    });

    const now = Date.now();
    return demands.map((d) => {
      const ref = d.statusChangedAt ?? d.updatedAt;
      const stalledDays = Math.floor((now - ref.getTime()) / 86_400_000);
      return {
        id: d.id,
        publicId: d.publicId,
        title: d.title,
        status: d.status as DemandStatus,
        areaId: d.areaId,
        updatedAt: d.updatedAt.toISOString(),
        stalledDays,
        spStep: d.spStep ?? null,
        isSmallProject: d.isSmallProject,
        statusChangedAt: d.statusChangedAt?.toISOString() ?? null,
        requesterName:   d.originator.name,
        assigneeName:    d.demandManager?.name ?? null,
      };
    });
  }

  // ── DM Actions ────────────────────────────────────────────────────────────

  private async validateDmScope(areaId: string | null, countryId: string | null, dmId: string, tx: Prisma.TransactionClient): Promise<void> {
    if (!areaId) throw new ForbiddenException('Demand has no area — DM scope check failed');

    const assignment = await tx.userRoleAssignment.findFirst({
      where: {
        userId: dmId,
        role: Role.DemandManager,
        OR: [
          { areaIds: { isEmpty: true } },
          { areaIds: { has: areaId } },
        ],
      },
      select: { areaIds: true, countryIds: true },
    });

    if (!assignment) throw new ForbiddenException('Demand is outside DM scope');

    // Country check is JS-level only — never pass countryId into Prisma has: (undefined behavior on null)
    if (assignment.areaIds.length > 0 && assignment.countryIds.length > 0) {
      if (!countryId || !assignment.countryIds.includes(countryId)) {
        throw new ForbiddenException('Demand is outside DM scope');
      }
    }
  }

  async dmAccept(id: string, dmId: string, dto: DmAcceptDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      if (full.isSmallProject) throw new BadRequestException('Use sp-accept for SP demands — dmAccept is for P demands only');

      if (!full.businessControllerId) {
        throw new BadRequestException('No Business Controller assigned to this demand — cannot route to BC review');
      }
      const nextStatus = DemandStatus.BC_REVIEW;

      await this.workflowService.transition(tx, full, nextStatus, dmId);
      await tx.demand.update({
        where: { id },
        data: {
          status: nextStatus,
          statusChangedAt: new Date(),
          dmDecision: 'ACCEPT',
          dmActionedBy: dmId,
          dmActionedAt: new Date(),
          eaInvolved: dto.eaInvolved ?? null,
          eaComment: dto.eaComment?.trim() || null,
          itSecurityInvolved: dto.itSecurityInvolved ?? null,
          itSecurityComment: dto.itSecurityComment?.trim() || null,
          itOpsInvolved: dto.itOpsInvolved ?? null,
          itOpsComment: dto.itOpsComment ?? null,
          fundingType: dto.fundingType ?? null,
          moveToSmallProject: dto.moveToSmallProject ?? null,
          ...(dto.glAccountId !== undefined && { glAccountId: dto.glAccountId }),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DM_ACCEPTED_TO_BC',
          changedBy: dmId,
          before: { status: full.status },
          after: { status: nextStatus },
        },
      });
      return await tx.demand.findUniqueOrThrow({ where: { id } });
    });

    this.eventEmitter.emit(DEMAND_EVENTS.BC_REVIEW_STARTED, new DemandBcReviewStartedEvent(id, dmId));
    return this.toResponse(demand);
  }

  async dmReturn(id: string, dmId: string, dto: DmReturnDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      await this.workflowService.transition(tx, full, DemandStatus.REROUTED, dmId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.REROUTED,
          statusChangedAt: new Date(),
          dmDecision: 'RETURN',
          dmCommentary: dto.dmCommentary,
          dmActionedBy: dmId,
          dmActionedAt: new Date(),
          eaInvolved: dto.eaInvolved ?? null,
          eaComment: dto.eaComment?.trim() || null,
          itSecurityInvolved: dto.itSecurityInvolved ?? null,
          itSecurityComment: dto.itSecurityComment?.trim() || null,
          itOpsInvolved: dto.itOpsInvolved ?? null,
          itOpsComment: dto.itOpsComment ?? null,
          fundingType: dto.fundingType ?? null,
          moveToSmallProject: dto.moveToSmallProject ?? null,
          ...(dto.glAccountId !== undefined && { glAccountId: dto.glAccountId }),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DEMAND_REROUTED',
          changedBy: dmId,
          before: { status: full.status },
          after: { status: DemandStatus.REROUTED, dmCommentary: dto.dmCommentary },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.DM_REROUTED, new DemandDmReroutedEvent(id, dmId, dto.dmCommentary));
    return this.toResponse(demand);
  }

  async dmReject(id: string, dmId: string, dto: DmRejectDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      await this.workflowService.transition(tx, full, DemandStatus.REJECTED, dmId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.REJECTED,
          statusChangedAt: new Date(),
          dmDecision: 'REJECT',
          dmCommentary: dto.dmCommentary,
          dmActionedBy: dmId,
          dmActionedAt: new Date(),
          eaInvolved: dto.eaInvolved ?? null,
          eaComment: dto.eaComment?.trim() || null,
          itSecurityInvolved: dto.itSecurityInvolved ?? null,
          itSecurityComment: dto.itSecurityComment?.trim() || null,
          itOpsInvolved: dto.itOpsInvolved ?? null,
          itOpsComment: dto.itOpsComment ?? null,
          fundingType: dto.fundingType ?? null,
          moveToSmallProject: dto.moveToSmallProject ?? null,
          ...(dto.glAccountId !== undefined && { glAccountId: dto.glAccountId }),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DEMAND_REJECTED',
          changedBy: dmId,
          before: { status: full.status },
          after: { status: DemandStatus.REJECTED, dmCommentary: dto.dmCommentary },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.DM_REJECTED, new DemandDmRejectedEvent(id, dmId, dto.dmCommentary));
    return this.toResponse(demand);
  }

  async dmPostpone(id: string, dmId: string, dto: DmPostponeDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      await this.workflowService.transition(tx, full, DemandStatus.ON_HOLD, dmId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.ON_HOLD,
          statusChangedAt: new Date(),
          dmDecision: 'POSTPONE',
          onHoldReason: dto.onHoldReason,
          dmActionedBy: dmId,
          dmActionedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DEMAND_POSTPONED',
          changedBy: dmId,
          before: { status: full.status },
          after: { status: DemandStatus.ON_HOLD, onHoldReason: dto.onHoldReason },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    return this.toResponse(demand);
  }

  async dmResume(id: string, dmId: string): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      await this.workflowService.transition(tx, full, DemandStatus.SUBMITTED, dmId);
      await tx.demand.update({
        where: { id },
        data: { status: DemandStatus.SUBMITTED, statusChangedAt: new Date(), dmDecision: null, onHoldReason: null },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DEMAND_RESUMED',
          changedBy: dmId,
          before: { status: DemandStatus.ON_HOLD },
          after: { status: DemandStatus.SUBMITTED },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    return this.toResponse(demand);
  }

  // ── SP Actions (Story 4.3) ────────────────────────────────────────────────

  async deleteDraft(id: string, requesterId: string): Promise<void> {
    await withDemandLock(this.prisma, id, async (_locked, tx) => {
      const demand = await tx.demand.findUniqueOrThrow({ where: { id } });
      if (demand.originatorId !== requesterId) throw new ForbiddenException();
      if (demand.status !== DemandStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT demands can be deleted');
      }
      await tx.demandMilestone.deleteMany({ where: { demandId: id } });
      await tx.demand.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DRAFT_DELETED',
          changedBy: requesterId,
          before: { status: DemandStatus.DRAFT, title: demand.title },
          after: Prisma.JsonNull,
        },
      });
    });
  }

  async spAccept(id: string, dmId: string): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      if (!full.isSmallProject) throw new BadRequestException('Demand is not an SP demand');
      if (full.status !== DemandStatus.SUBMITTED) throw new BadRequestException(`Cannot sp-accept from status ${full.status}`);
      if (full.spStep !== null) throw new BadRequestException(`Demand is already past DM Review (spStep: ${full.spStep})`);
      await tx.demand.update({
        where: { id },
        data: { spStep: SpStep.DM_COST_ESTIMATION, dmDecision: 'ACCEPT', dmActionedBy: dmId, dmActionedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand', entityId: id, eventType: 'SP_DM_ACCEPTED', changedBy: dmId,
          before: { spStep: null }, after: { spStep: SpStep.DM_COST_ESTIMATION },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.SP_DM_ACCEPTED, new DemandSpDmAcceptedEvent(id, dmId));
    return this.toResponse(demand);
  }

  async spSubmitEstimate(id: string, dmId: string): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      if (!full.isSmallProject) throw new BadRequestException('Demand is not an SP demand');
      if (![DemandStatus.SUBMITTED, DemandStatus.REROUTED].includes(full.status as DemandStatus))
        throw new BadRequestException(`Cannot submit estimate from status ${full.status}`);
      if (full.spStep !== SpStep.DM_COST_ESTIMATION)
        throw new BadRequestException('Demand is not at DM Cost Estimation step');
      await this.workflowService.transition(tx, full, DemandStatus.SP_OFFER_REVIEW, dmId);
      await tx.demand.update({
        where: { id },
        data: { status: DemandStatus.SP_OFFER_REVIEW, statusChangedAt: new Date(), spStep: SpStep.DR_OFFER_REVIEW, drCommentary: null },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand', entityId: id, eventType: 'SP_ESTIMATE_SUBMITTED', changedBy: dmId,
          before: { status: full.status, spStep: full.spStep },
          after: { status: DemandStatus.SP_OFFER_REVIEW, spStep: SpStep.DR_OFFER_REVIEW },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.SP_OFFER_SENT, new DemandSpOfferSentEvent(id, dmId));
    return this.toResponse(demand);
  }

  async spAcceptAndEstimate(id: string, dmId: string): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);
      if (!full.isSmallProject) throw new BadRequestException('Demand is not an SP demand');

      const isInitialReview = full.status === DemandStatus.SUBMITTED && full.spStep === null;
      const isReworkReentry = (
        full.status === DemandStatus.SUBMITTED || full.status === DemandStatus.REROUTED
      ) && full.spStep === SpStep.DM_COST_ESTIMATION;
      if (!isInitialReview && !isReworkReentry) {
        throw new BadRequestException(
          `Cannot sp-accept-and-estimate from status ${full.status} / spStep ${full.spStep}`,
        );
      }

      const opexEntries = await tx.financialPlanEntry.findMany({ where: { demandId: id, category: 'opex' } });
      // AC-8: only count entries within the demand's active date range
      const activeOpex = (() => {
        if (!full.startDate || !full.endDate) return opexEntries;
        const active = new Set<string>();
        const cur = new Date(full.startDate.getFullYear(), full.startDate.getMonth(), 1);
        const lim = new Date(full.endDate.getFullYear(),   full.endDate.getMonth(),   1);
        while (cur <= lim) { active.add(`${cur.getFullYear()}:${cur.getMonth() + 1}`); cur.setMonth(cur.getMonth() + 1); }
        return opexEntries.filter((e) => active.has(`${e.year}:${e.month}`));
      })();
      const hasAnyOpex = activeOpex.some((e) => e.valueCents > 0);
      if (!hasAnyOpex) {
        throw new UnprocessableEntityException('Please enter the cost estimate before accepting');
      }

      await this.workflowService.transition(tx, full, DemandStatus.SP_OFFER_REVIEW, dmId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.SP_OFFER_REVIEW,
          statusChangedAt: new Date(),
          spStep: SpStep.DR_OFFER_REVIEW,
          dmDecision: 'ACCEPT',
          dmActionedBy: dmId,
          dmActionedAt: new Date(),
          drCommentary: null,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'SP_DM_ACCEPTED_AND_ESTIMATED',
          changedBy: dmId,
          before: { status: full.status, spStep: full.spStep },
          after: { status: DemandStatus.SP_OFFER_REVIEW, spStep: SpStep.DR_OFFER_REVIEW },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.SP_OFFER_SENT, new DemandSpOfferSentEvent(id, dmId));
    return this.toResponse(demand);
  }

  async spAcceptOffer(id: string, originatorId: string): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      if (full.originatorId !== originatorId) throw new ForbiddenException('Only the demand originator can accept the offer');
      if (!full.isSmallProject) throw new BadRequestException('Demand is not an SP demand');
      if (full.status !== DemandStatus.SP_OFFER_REVIEW)
        throw new BadRequestException('Demand is not at DR Offer Review step');
      await this.workflowService.transition(tx, full, DemandStatus.IN_REVIEW, originatorId);
      await tx.demand.update({ where: { id }, data: { status: DemandStatus.IN_REVIEW, statusChangedAt: new Date(), spStep: SpStep.PM_DECISION } });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand', entityId: id, eventType: 'SP_OFFER_ACCEPTED', changedBy: originatorId,
          before: { status: DemandStatus.SP_OFFER_REVIEW, spStep: SpStep.DR_OFFER_REVIEW },
          after: { status: DemandStatus.IN_REVIEW, spStep: SpStep.PM_DECISION },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.SP_OFFER_ACCEPTED, new DemandSpOfferAcceptedEvent(id, originatorId));
    return this.toResponse(demand);
  }

  async spReworkOffer(id: string, originatorId: string, dto: SpReworkOfferDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      if (full.originatorId !== originatorId) throw new ForbiddenException('Only the demand originator can rework the offer');
      if (!full.isSmallProject) throw new BadRequestException('Demand is not an SP demand');
      if (full.status !== DemandStatus.SP_OFFER_REVIEW)
        throw new BadRequestException('Demand is not at DR Offer Review step');
      await this.workflowService.transition(tx, full, DemandStatus.REROUTED, originatorId);
      await tx.demand.update({
        where: { id },
        data: { status: DemandStatus.REROUTED, statusChangedAt: new Date(), spStep: SpStep.DM_COST_ESTIMATION, drCommentary: dto.commentary },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand', entityId: id, eventType: 'SP_OFFER_REWORKED', changedBy: originatorId,
          before: { status: DemandStatus.SP_OFFER_REVIEW, spStep: SpStep.DR_OFFER_REVIEW },
          after: { status: DemandStatus.REROUTED, spStep: SpStep.DM_COST_ESTIMATION },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.SP_OFFER_REWORKED, new DemandSpOfferReworkedEvent(id, originatorId));
    return this.toResponse(demand);
  }

  // ── PM Queue ──────────────────────────────────────────────────────────────

  async getPmQueue(
    pmId: string,
    filters: { status?: string; search?: string; stalledOnly?: boolean } = {},
  ): Promise<PmQueueItem[]> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId: pmId, role: Role.PortfolioManager },
      select: { scopeType: true, scopeId: true },
    });
    if (assignments.length === 0) return [];

    const isGlobal = assignments.some((a) => a.scopeType === 'global');
    const costCentreIds = isGlobal
      ? undefined
      : (assignments.map((a) => a.scopeId).filter(Boolean) as string[]);

    if (!isGlobal && (!costCentreIds || costCentreIds.length === 0)) return [];

    const validStatuses = Object.values(DemandStatus) as string[];
    const statusFilter =
      filters.status && validStatuses.includes(filters.status)
        ? (filters.status as DemandStatus)
        : undefined; // undefined = no status filter ("All")

    const stallCutoff = filters.stalledOnly
      ? new Date(Date.now() - DM_STALL_THRESHOLD_DAYS * 86_400_000)
      : undefined;

    const demands = await this.prisma.demand.findMany({
      where: {
        AND: [
          ...(costCentreIds ? [{ costCentreId: { in: costCentreIds } }] : []),
          ...(statusFilter
            ? [{ status: statusFilter }]
            : [{
                status: {
                  notIn: [
                    DemandStatus.BC_REVIEW,
                    DemandStatus.APPROVED,
                    DemandStatus.IN_EXECUTION,
                    DemandStatus.COMPLETED,
                    DemandStatus.REJECTED,
                    DemandStatus.CANCELLED,
                  ],
                },
              }]),
          // AC-8: exclude SP demands at DR_OFFER_REVIEW step from PM queue
          // AC-8: only show P demands OR SP demands that have reached PM_DECISION
          {
            OR: [
              { isSmallProject: false },
              { isSmallProject: true, spStep: SpStep.PM_DECISION },
            ],
          },
          ...(filters.search ? [{ title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } }] : []),
          ...(stallCutoff
            ? [{
                OR: [
                  { statusChangedAt: { lte: stallCutoff } },
                  { statusChangedAt: null, updatedAt: { lte: stallCutoff } },
                ],
              }]
            : []),
        ],
      },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, publicId: true, title: true, status: true, costCentreId: true, updatedAt: true, statusChangedAt: true, isSmallProject: true,
        originator: { select: { name: true } },
      },
    });

    const now = Date.now();
    return demands.map((d) => ({
      id: d.id,
      publicId: d.publicId,
      title: d.title,
      status: d.status as DemandStatus,
      costCentreId: d.costCentreId,
      updatedAt: d.updatedAt.toISOString(),
      isSmallProject:  d.isSmallProject,
      stalledDays:     Math.floor((now - (d.statusChangedAt ?? d.updatedAt).getTime()) / 86_400_000),
      statusChangedAt: d.statusChangedAt?.toISOString() ?? null,
      requesterName:   d.originator.name,
      assigneeName:    null,
    }));
  }

  // ── PM Actions ────────────────────────────────────────────────────────────

  private async validatePmScope(costCentreId: string | null, pmId: string, tx: Prisma.TransactionClient): Promise<void> {
    const assignments = await tx.userRoleAssignment.findMany({
      where: { userId: pmId, role: Role.PortfolioManager },
      select: { scopeType: true, scopeId: true },
    });
    if (assignments.length === 0) throw new ForbiddenException('User has no Portfolio Manager assignment');
    if (assignments.some((a) => a.scopeType === 'global')) return;
    if (!costCentreId) throw new ForbiddenException('Demand has no cost centre — PM scope check failed');
    if (!assignments.some((a) => a.scopeType === 'cost_centre' && a.scopeId === costCentreId)) {
      throw new ForbiddenException('Demand is outside PM scope');
    }
  }

  async pmApprove(id: string, pmId: string, dto: PmApproveDto): Promise<DemandResponse> {
    let projectId: string | undefined;
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validatePmScope(full.costCentreId, pmId, tx);
      if (dto.assignedPmId) {
        const pmAssignment = await tx.userRoleAssignment.findFirst({
          where: { userId: dto.assignedPmId, role: Role.ProjectManager },
          select: { userId: true },
        });
        if (!pmAssignment) {
          throw new BadRequestException('Selected user is not a valid Project Manager');
        }
      }
      await this.workflowService.transition(tx, full, DemandStatus.APPROVED, pmId);
      const project = await tx.project.create({
        data: {
          demandId: id,
          status: 'DRAFT',
          assignedPmId: dto.assignedPmId ?? null,
          // snapshot-copy from demand (one-way, no sync-back):
          objective: full.objective ?? null,
          necessity: full.necessity ?? null,
          gxpRelevant: full.isGxpRelevant,
          eaInvolved: full.eaInvolved ?? null,
          eaComment: full.eaComment?.trim() || null,
          itSecurityInvolved: full.itSecurityInvolved ?? null,
          itSecurityComment: full.itSecurityComment?.trim() || null,
          qualitativeValue: full.qualitativeValueCategory ?? null,
          quantitativeValue: full.quantitativeValueCategory ?? null,
          valueCaseDescription: full.benefitsObjectives ?? null,
        },
      });
      projectId = project.id;
      const demandEntries = await tx.financialPlanEntry.findMany({ where: { demandId: id } });
      if (demandEntries.length > 0) {
        await tx.projectFinancialPlanEntry.createMany({
          skipDuplicates: true,
          data: demandEntries.map((e) => ({
            projectId: project.id,
            glAccountId: e.glAccountId,
            category: e.category,
            month: e.month,
            year: e.year,
            valueCents: e.valueCents,
            isActual: e.isActual,
            isUserSet: e.isUserSet,
          })),
        });
      }
      await tx.demand.update({
        where: { id },
        data: { status: DemandStatus.APPROVED, statusChangedAt: new Date(), pmActionedBy: pmId, pmActionedAt: new Date(), spStep: null },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DEMAND_PM_APPROVED',
          changedBy: pmId,
          before: { status: full.status, spStep: full.spStep ?? null },
          after: { status: DemandStatus.APPROVED, spStep: null, assignedPmId: dto.assignedPmId },
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: project.id,
          eventType: 'PROJECT_CREATED',
          changedBy: pmId,
          before: Prisma.JsonNull,
          after: {
            status: 'DRAFT',
            demandId: id,
            assignedPmId: dto.assignedPmId ?? null,
            objective: full.objective ?? null,
            necessity: full.necessity ?? null,
            gxpRelevant: full.isGxpRelevant,
            eaInvolved: full.eaInvolved ?? null,
            eaComment: full.eaComment?.trim() || null,
            itSecurityInvolved: full.itSecurityInvolved ?? null,
            itSecurityComment: full.itSecurityComment?.trim() || null,
            qualitativeValue: full.qualitativeValueCategory ?? null,
            quantitativeValue: full.quantitativeValueCategory ?? null,
            valueCaseDescription: full.benefitsObjectives ?? null,
            financialEntriesCopied: demandEntries.length,
          },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.PM_APPROVED, new DemandPmApprovedEvent(id, pmId));
    return this.toResponse(demand, projectId ?? null);
  }

  async pmReject(id: string, pmId: string, dto: PmRejectDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validatePmScope(full.costCentreId, pmId, tx);
      await this.workflowService.transition(tx, full, DemandStatus.REJECTED, pmId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.REJECTED,
          statusChangedAt: new Date(),
          pmCommentary: dto.pmCommentary,
          pmActionedBy: pmId,
          pmActionedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DEMAND_PM_REJECTED',
          changedBy: pmId,
          before: { status: full.status },
          after: { status: DemandStatus.REJECTED, pmCommentary: dto.pmCommentary },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.PM_REJECTED, new DemandPmRejectedEvent(id, pmId, dto.pmCommentary));
    return this.toResponse(demand);
  }

  async pmSendBack(id: string, pmId: string, dto: PmSendBackDto): Promise<DemandResponse> {
    const targetStatus = dto.target === 'requester' ? DemandStatus.REROUTED : DemandStatus.SUBMITTED;
    const eventType = dto.target === 'requester' ? 'PM_SENT_TO_REQUESTER' : 'PM_SENT_TO_DM';
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validatePmScope(full.costCentreId, pmId, tx);
      await this.workflowService.transition(tx, full, targetStatus, pmId);
      await tx.demand.update({
        where: { id },
        data: { status: targetStatus, statusChangedAt: new Date(), pmCommentary: dto.commentary, pmActionedBy: pmId, pmActionedAt: new Date(), spStep: null },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType,
          changedBy: pmId,
          before: { status: full.status },
          after: { status: targetStatus, commentary: dto.commentary },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    if (dto.target === 'requester') {
      this.eventEmitter.emit(DEMAND_EVENTS.PM_SENT_TO_REQUESTER, new DemandPmSentToRequesterEvent(id, pmId, dto.commentary));
    } else {
      this.eventEmitter.emit(DEMAND_EVENTS.PM_SENT_TO_DM, new DemandPmSentToDmEvent(id, pmId, dto.commentary));
    }
    return this.toResponse(demand);
  }

  // ── Demand History ────────────────────────────────────────────────────────

  async getDemandHistory(id: string, requesterId: string, requesterRoles: string[]): Promise<DemandHistoryItem[]> {
    const demand = await this.prisma.demand
      .findUniqueOrThrow({ where: { id } })
      .catch(() => { throw new NotFoundException(`Demand ${id} not found`); });

    const canViewAll =
      requesterRoles.includes(Role.DemandManager) ||
      requesterRoles.includes(Role.PortfolioManager) ||
      requesterRoles.includes(Role.BusinessController);
    if (!canViewAll && demand.originatorId !== requesterId) {
      throw new NotFoundException(`Demand ${id} not found`);
    }

    const entries = await this.prisma.auditLog.findMany({
      where: { entityType: 'Demand', entityId: id },
      orderBy: { changedAt: 'asc' },
    });

    const actorIds = [...new Set(entries.map((e) => e.changedBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    return entries.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      changedBy: e.changedBy,
      actorName: nameMap.get(e.changedBy) ?? e.changedBy,
      changedAt: e.changedAt.toISOString(),
      before: e.before ?? null,
      after: e.after ?? null,
    }));
  }

  // ── BC Actions (Story 4.11) ──────────────────────────────────────────────

  private async validateBcScope(businessControllerId: string | null, actorId: string): Promise<void> {
    if (businessControllerId !== actorId) {
      throw new ForbiddenException('This demand is not in your BC scope');
    }
  }

  async getBcQueue(bcUserId: string): Promise<BcQueueItem[]> {
    const demands = await this.prisma.demand.findMany({
      where: {
        businessControllerId: bcUserId,
        status: DemandStatus.BC_REVIEW,
      },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, publicId: true, title: true, status: true, areaId: true, updatedAt: true, statusChangedAt: true, isSmallProject: true,
        originator:          { select: { name: true } },
        businessController:  { select: { name: true } },
      },
    });
    const now = Date.now();
    return demands.map((d) => ({
      id: d.id,
      publicId: d.publicId,
      title: d.title,
      status: d.status as DemandStatus,
      areaId: d.areaId ?? null,
      updatedAt: d.updatedAt.toISOString(),
      isSmallProject:  d.isSmallProject,
      stalledDays:     Math.floor((now - (d.statusChangedAt ?? d.updatedAt).getTime()) / 86_400_000),
      statusChangedAt: d.statusChangedAt?.toISOString() ?? null,
      requesterName:   d.originator.name,
      assigneeName:    d.businessController?.name ?? null,
    }));
  }

  private async getDrQueue(
    userId: string,
    filters: { search?: string } = {},
  ): Promise<UnifiedQueueItem[]> {
    const demands = await this.prisma.demand.findMany({
      where: {
        originatorId: userId,
        status: DemandStatus.SP_OFFER_REVIEW,
        spStep: SpStep.DR_OFFER_REVIEW,
        ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
      orderBy: { statusChangedAt: 'asc' },
      select: { id: true, publicId: true, title: true, status: true, areaId: true, updatedAt: true, statusChangedAt: true, spStep: true, isSmallProject: true,
        originator: { select: { name: true } },
      },
    });

    const now = Date.now();
    return demands.map((d) => {
      const ref = d.statusChangedAt ?? d.updatedAt;
      const stalledDays = Math.floor((now - ref.getTime()) / 86_400_000);
      return {
        id: d.id,
        publicId: d.publicId,
        title: d.title,
        status: d.status as DemandStatus,
        areaId: d.areaId ?? null,
        updatedAt: d.updatedAt.toISOString(),
        stalledDays,
        spStep: d.spStep ?? null,
        isSmallProject: d.isSmallProject,
        statusChangedAt: d.statusChangedAt?.toISOString() ?? null,
        requesterName:   d.originator.name,
        assigneeName:    null,
        requiredRole: 'DemandRequester' as const,
      };
    });
  }

  async getUnifiedQueue(
    userId: string,
    filters: { search?: string; stalledOnly?: boolean; onHoldOnly?: boolean } = {},
  ): Promise<UnifiedQueueItem[]> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      select: { role: true },
    });
    const roles = new Set(assignments.map((a) => a.role));

    const [dmItems, bcItems, pmItems, drItems] = await Promise.all([
      roles.has(Role.DemandManager)
        ? this.getDmQueue(userId, {
            status: filters.onHoldOnly ? DemandStatus.ON_HOLD : DemandStatus.SUBMITTED,
            search: filters.search,
            stalledOnly: filters.onHoldOnly ? false : filters.stalledOnly,
          })
        : Promise.resolve([]),
      // BC queue only handles BC_REVIEW status; ON_HOLD is a DM concern
      roles.has(Role.BusinessController) && !filters.onHoldOnly ? this.getBcQueue(userId) : Promise.resolve([]),
      roles.has(Role.PortfolioManager) && !filters.onHoldOnly
        ? this.getPmQueue(userId, {
            search: filters.search,
            stalledOnly: filters.stalledOnly,
          })
        : Promise.resolve([]),
      roles.has(Role.DemandRequester) && !filters.onHoldOnly
        ? this.getDrQueue(userId, { search: filters.search })
        : Promise.resolve([]),
    ]);

    const filteredBcItems = bcItems
      .filter((i) => !filters.search || i.title.toLowerCase().includes(filters.search.toLowerCase()))
      .filter((i) => !filters.stalledOnly || (i.stalledDays ?? 0) > 7);

    const seen = new Set<string>();
    const merged: UnifiedQueueItem[] = [];

    for (const item of dmItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push({
          id: item.id, publicId: item.publicId, title: item.title, status: item.status, updatedAt: item.updatedAt,
          stalledDays: item.stalledDays, areaId: item.areaId, spStep: item.spStep ?? null,
          isSmallProject: item.isSmallProject, requiredRole: 'DemandManager',
          statusChangedAt: item.statusChangedAt ?? null,
          requesterName: item.requesterName,
          assigneeName: item.assigneeName ?? null,
        });
      }
    }
    for (const item of filteredBcItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push({
          id: item.id, publicId: item.publicId, title: item.title, status: item.status, updatedAt: item.updatedAt,
          stalledDays: item.stalledDays, areaId: item.areaId, isSmallProject: item.isSmallProject, requiredRole: 'BusinessController',
          statusChangedAt: item.statusChangedAt ?? null,
          requesterName: item.requesterName,
          assigneeName: item.assigneeName ?? null,
        });
      }
    }
    for (const item of pmItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push({
          id: item.id, publicId: item.publicId, title: item.title, status: item.status, updatedAt: item.updatedAt,
          stalledDays: item.stalledDays, costCentreId: item.costCentreId, isSmallProject: item.isSmallProject, requiredRole: 'PortfolioManager',
          statusChangedAt: item.statusChangedAt ?? null,
          requesterName: item.requesterName,
          assigneeName: item.assigneeName ?? null,
        });
      }
    }
    for (const item of drItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }

    // Two-tier: overdue items (>7 days) first, then oldest-first within each tier (AC-3)
    return merged.sort((a, b) => {
      const aOver = (a.stalledDays ?? 0) > 7 ? 1 : 0;
      const bOver = (b.stalledDays ?? 0) > 7 ? 1 : 0;
      if (bOver !== aOver) return bOver - aOver;
      return (a.stalledDays ?? 0) - (b.stalledDays ?? 0);
    });
  }

  async bcApprove(id: string, actorId: string): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateBcScope(full.businessControllerId, actorId);
      await this.workflowService.transition(tx, full, DemandStatus.IN_REVIEW, actorId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.IN_REVIEW,
          statusChangedAt: new Date(),
          bcStatus: 'APPROVED',
          bcActionedBy: actorId,
          bcActionedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'BC_APPROVED',
          changedBy: actorId,
          before: { status: DemandStatus.BC_REVIEW },
          after: { status: DemandStatus.IN_REVIEW },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.BC_APPROVED, new DemandBcApprovedEvent(id, actorId));
    return this.toResponse(demand);
  }

  async bcReject(id: string, actorId: string, dto: BcRejectDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateBcScope(full.businessControllerId, actorId);
      await this.workflowService.transition(tx, full, DemandStatus.REJECTED, actorId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.REJECTED,
          statusChangedAt: new Date(),
          bcStatus: 'REJECTED',
          bcActionedBy: actorId,
          bcActionedAt: new Date(),
          bcCommentary: dto.commentary,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'BC_REJECTED',
          changedBy: actorId,
          before: { status: DemandStatus.BC_REVIEW },
          after: { status: DemandStatus.REJECTED, commentary: dto.commentary },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.BC_REJECTED, new DemandBcRejectedEvent(id, actorId, dto.commentary));
    return this.toResponse(demand);
  }

  async bcSendToRequester(id: string, actorId: string, dto: BcSendToRequesterDto): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateBcScope(full.businessControllerId, actorId);
      await this.workflowService.transition(tx, full, DemandStatus.REROUTED, actorId);
      await tx.demand.update({
        where: { id },
        data: {
          status: DemandStatus.REROUTED,
          statusChangedAt: new Date(),
          bcStatus: 'REROUTED_TO_REQUESTER',
          bcActionedBy: actorId,
          bcActionedAt: new Date(),
          bcCommentary: dto.commentary,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'BC_REROUTED_TO_REQUESTER',
          changedBy: actorId,
          before: { status: DemandStatus.BC_REVIEW },
          after: { status: DemandStatus.REROUTED, commentary: dto.commentary },
        },
      });
      return tx.demand.findUniqueOrThrow({ where: { id } });
    });
    this.eventEmitter.emit(DEMAND_EVENTS.BC_REROUTED_TO_REQUESTER, new DemandBcReroutedToRequesterEvent(id, actorId, dto.commentary));
    return this.toResponse(demand);
  }

  // ── P→SP Type Switch (Story 4.14) ────────────────────────────────────────

  async convertToSmallProject(id: string, dmId: string): Promise<DemandResponse> {
    const demand = await withDemandLock(this.prisma, id, async (locked, tx) => {
      const full = await tx.demand.findUniqueOrThrow({ where: { id: locked.id } });
      await this.validateDmScope(full.areaId, full.countryId ?? null, dmId, tx);

      if (full.isSmallProject) {
        throw new BadRequestException('Demand is already an SP demand');
      }
      if (![DemandStatus.SUBMITTED, DemandStatus.BC_REVIEW].includes(full.status as DemandStatus)) {
        throw new BadRequestException(`Cannot convert to SP from status ${full.status}`);
      }

      await tx.demand.update({
        where: { id },
        data: {
          isSmallProject: true,
          spStep: SpStep.DR_OFFER_REVIEW,
          status: DemandStatus.SP_OFFER_REVIEW,
          statusChangedAt: new Date(),
          ...(full.status === DemandStatus.BC_REVIEW && { bcStatus: null }),
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'Demand',
          entityId: id,
          eventType: 'DEMAND_TYPE_SWITCHED',
          changedBy: dmId,
          before: { type: 'P', status: full.status },
          after: { type: 'SP', status: DemandStatus.SP_OFFER_REVIEW, spStep: SpStep.DR_OFFER_REVIEW, isSmallProject: true },
        },
      });

      return tx.demand.findUniqueOrThrow({ where: { id } });
    });

    this.eventEmitter.emit(DEMAND_EVENTS.DEMAND_TYPE_SWITCHED, new DemandTypeSwitchedEvent(id, dmId));
    return this.toResponse(demand);
  }

  // ── Dashboard Stats ───────────────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStatsResponse> {
    const inactiveStatuses = [DemandStatus.DRAFT, DemandStatus.COMPLETED, DemandStatus.CANCELLED, DemandStatus.REJECTED];
    const activeStatuses = Object.values(DemandStatus).filter(
      (s) => !inactiveStatuses.includes(s),
    );
    const committedStatuses = [DemandStatus.APPROVED, DemandStatus.IN_EXECUTION];
    const pendingStatuses = [DemandStatus.SUBMITTED, DemandStatus.BC_REVIEW, DemandStatus.IN_REVIEW];

    const [totalActiveDemands, demandsPendingDecision, committedBudget, plannedBudget, activeDemands] =
      await Promise.all([
        this.prisma.demand.count({ where: { status: { in: activeStatuses } } }),
        this.prisma.demand.count({ where: { status: { in: pendingStatuses } } }),
        this.prisma.financialPlanEntry.aggregate({
          _sum: { valueCents: true },
          where: { demand: { status: { in: committedStatuses } } },
        }),
        this.prisma.financialPlanEntry.aggregate({
          _sum: { valueCents: true },
          where: { demand: { status: { in: activeStatuses } } },
        }),
        this.prisma.demand.findMany({ where: { status: { in: activeStatuses } } }),
      ]);

    const stalledStatuses = new Set([
      DemandStatus.SUBMITTED, DemandStatus.BC_REVIEW, DemandStatus.IN_REVIEW, DemandStatus.REROUTED, DemandStatus.ON_HOLD,
    ]);
    const now = Date.now();
    const stalledDemands = activeDemands
      .filter((d: { status: string; statusChangedAt: Date | null; updatedAt: Date }) => {
        if (!stalledStatuses.has(d.status as DemandStatus)) return false;
        const ref = d.statusChangedAt ?? d.updatedAt;
        return Math.floor((now - ref.getTime()) / 86_400_000) > DM_STALL_THRESHOLD_DAYS;
      })
      .map((d: Parameters<typeof this.toResponse>[0]) => this.toResponse(d));

    return {
      totalActiveDemands,
      budgetCommittedCents: committedBudget._sum.valueCents ?? 0,
      budgetPlannedCents: plannedBudget._sum.valueCents ?? 0,
      demandsPendingDecision,
      stalledDemands,
    };
  }

  private toResponse(demand: {
    id: string;
    publicId: number;
    title: string;
    description: string;
    status: string;
    originatorId: string;
    costCentreId: string | null;
    glAccountId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    draftSavedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    legalEntityId: string | null;
    areaId: string | null;
    demandManagerId: string | null;
    demandOwner: string | null;
    objective: string | null;
    necessity: string | null;
    isMandatory: boolean;
    qualitativeValueCategory: boolean | null;
    quantitativeValueCategory: boolean | null;
    reasoningForMandatory?: string | null;
    asisDescription: string | null;
    benefitsObjectives: string | null;
    tobeDescription: string | null;
    isSmallProject: boolean;
    isGxpRelevant: boolean;
    submittedAt: Date | null;
    dmDecision?: string | null;
    dmCommentary?: string | null;
    eaInvolved?: boolean | null;
    eaComment?: string | null;
    itSecurityInvolved?: boolean | null;
    itSecurityComment?: string | null;
    itOpsInvolved?: boolean | null;
    itOpsComment?: string | null;
    top10Conformity?: string | null;
    top10ConformityComments?: string | null;
    fundingType?: string | null;
    moveToSmallProject?: boolean | null;
    onHoldReason?: string | null;
    dmActionedBy?: string | null;
    dmActionedAt?: Date | null;
    pmCommentary?: string | null;
    pmActionedBy?: string | null;
    pmActionedAt?: Date | null;
    spStep?: string | null;
    drCommentary?: string | null;
    businessControllerId?: string | null;
    bcStatus?: string | null;
    bcActionedBy?: string | null;
    bcActionedAt?: Date | null;
    bcCommentary?: string | null;
    demandScope?: string | null;
    countryId?: string | null;
    costCentre?: { code: string; name: string } | null;
    legalEntity?: { code: string; name: string } | null;
    area?: { code: string; name: string } | null;
    country?: { id: string; code: string; name: string } | null;
  }, projectId?: string | null): DemandResponse {
    return {
      id: demand.id,
      publicId: demand.publicId,
      title: demand.title,
      description: demand.description,
      status: demand.status as DemandStatus,
      originatorId: demand.originatorId,
      costCentreId: demand.costCentreId,
      glAccountId: demand.glAccountId,
      startDate: demand.startDate?.toISOString() ?? null,
      endDate: demand.endDate?.toISOString() ?? null,
      draftSavedAt: demand.draftSavedAt?.toISOString() ?? null,
      createdAt: demand.createdAt.toISOString(),
      updatedAt: demand.updatedAt.toISOString(),
      legalEntityId: demand.legalEntityId ?? null,
      areaId: demand.areaId ?? null,
      demandManagerId: demand.demandManagerId ?? null,
      demandOwner: demand.demandOwner ?? null,
      objective: demand.objective ?? null,
      necessity: demand.necessity ?? null,
      isMandatory: demand.isMandatory ?? false,
      qualitativeValueCategory: demand.qualitativeValueCategory ?? null,
      quantitativeValueCategory: demand.quantitativeValueCategory ?? null,
      reasoningForMandatory: demand.reasoningForMandatory ?? null,
      asisDescription: demand.asisDescription ?? null,
      benefitsObjectives: demand.benefitsObjectives ?? null,
      tobeDescription: demand.tobeDescription ?? null,
      isSmallProject: demand.isSmallProject ?? false,
      isGxpRelevant: demand.isGxpRelevant ?? false,
      projectType: demand.isSmallProject ? 'SP' : 'P',
      submittedAt: demand.submittedAt?.toISOString() ?? null,
      dmDecision: demand.dmDecision ?? null,
      dmCommentary: demand.dmCommentary ?? null,
      eaInvolved: demand.eaInvolved ?? null,
      eaComment: demand.eaComment ?? null,
      itSecurityInvolved: demand.itSecurityInvolved ?? null,
      itSecurityComment: demand.itSecurityComment ?? null,
      itOpsInvolved: demand.itOpsInvolved ?? null,
      itOpsComment: demand.itOpsComment ?? null,
      top10Conformity: demand.top10Conformity ?? null,
      top10ConformityComments: demand.top10ConformityComments ?? null,
      fundingType: (demand.fundingType as 'Business' | 'IT' | null) ?? null,
      moveToSmallProject: demand.moveToSmallProject ?? null,
      onHoldReason: demand.onHoldReason ?? null,
      dmActionedBy: demand.dmActionedBy ?? null,
      dmActionedAt: demand.dmActionedAt?.toISOString() ?? null,
      pmCommentary: demand.pmCommentary ?? null,
      pmActionedBy: demand.pmActionedBy ?? null,
      pmActionedAt: demand.pmActionedAt?.toISOString() ?? null,
      spStep: demand.spStep ?? null,
      drCommentary: demand.drCommentary ?? null,
      businessControllerId: demand.businessControllerId ?? null,
      bcStatus: demand.bcStatus ?? null,
      bcActionedBy: demand.bcActionedBy ?? null,
      bcActionedAt: demand.bcActionedAt?.toISOString() ?? null,
      bcCommentary: demand.bcCommentary ?? null,
      projectId: projectId ?? null,
      demandScope: (demand.demandScope as 'GLOBAL' | 'LOCAL' | null) ?? null,
      countryId: demand.countryId ?? null,
      country: demand.country ?? null,
      costCentre: demand.costCentre ?? null,
      legalEntity: demand.legalEntity ?? null,
      area: demand.area ?? null,
    };
  }
}
