import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { DemandsService } from '../../src/demands/demands.service';
import { DemandWorkflowService } from '../../src/demands/demand-workflow.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SystemConfigService } from '../../src/config/system-config.service';
import { FlagService } from '../../src/config/flag.service';
import { DemandStatus } from '@helix/shared';
import { DEMAND_EVENTS } from '../../src/notifications/events/demand.events';

const ORIGINATOR_ID = 'originator-cuid-1';
const BC_ID = 'bc-user-cuid-1';
const DM_ID = 'dm-user-cuid-1';
const DEMAND_ID = 'demand-cuid-1';
const AREA_ID = 'area-cuid-1';
const COST_CENTRE_ID = 'cc-cuid-1';

const baseDemand = {
  id: DEMAND_ID,
  publicId: 1,
  title: 'Test Demand',
  description: 'Test description',
  status: DemandStatus.SUBMITTED,
  originatorId: ORIGINATOR_ID,
  costCentreId: COST_CENTRE_ID,
  glAccountId: null,
  startDate: null,
  endDate: null,
  draftSavedAt: null,
  businessControllerId: BC_ID,
  bcStatus: null,
  bcActionedAt: null,
  bcActionedBy: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  legalEntityId: null,
  areaId: AREA_ID,
  demandManagerId: DM_ID,
  demandOwner: null,
  objective: null,
  necessity: null,
  isMandatory: false,
  qualitativeValueCategory: null,
  quantitativeValueCategory: null,
  reasoningForMandatory: null,
  asisDescription: null,
  benefitsObjectives: null,
  tobeDescription: null,
  isSmallProject: false,
  isGxpRelevant: false,
  submittedAt: new Date('2026-07-01T00:00:00.000Z'),
  dmDecision: null,
  dmCommentary: null,
  eaInvolved: null,
  eaComment: null,
  itSecurityInvolved: null,
  itSecurityComment: null,
  itOpsInvolved: null,
  itOpsComment: null,
  top10Conformity: null,
  top10ConformityComments: null,
  moveToSmallProject: null,
  onHoldReason: null,
  dmActionedBy: null,
  dmActionedAt: null,
  pmCommentary: null,
  pmActionedBy: null,
  pmActionedAt: null,
  spStep: null,
  drCommentary: null,
};

const bcReviewDemand = { ...baseDemand, status: DemandStatus.BC_REVIEW };

const DEFAULT_SYSTEM_CONFIG = {
  spThresholdEurCents: 5_000_000,
  intakeWindowStart: null,
  intakeWindowEnd: null,
  budgetCycleStart: null,
  budgetCycleEnd: null,
  gxpItValidationDays: 30,
  gxpDocumentationDays: 14,
};

describe('DemandsService — BC Workflow (Story 4.11)', () => {
  let service: DemandsService;
  let eventEmitter: { emit: jest.Mock };
  let flagService: { get: jest.Mock };
  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    demand: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
    auditLog: { create: jest.Mock; findMany: jest.Mock };
    userRoleAssignment: { findMany: jest.Mock; findFirst: jest.Mock };
    project: { create: jest.Mock };
    user: { findMany: jest.Mock };
    financialPlanEntry: { aggregate: jest.Mock; findMany: jest.Mock };
    demandMilestone: { createMany: jest.Mock; deleteMany: jest.Mock };
    smallProjectArea: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    eventEmitter = { emit: jest.fn() };
    flagService = { get: jest.fn().mockResolvedValue(true) };

    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: DEMAND_ID }]),
      demand: {
        create: jest.fn().mockResolvedValue(baseDemand),
        update: jest.fn().mockResolvedValue(bcReviewDemand),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(bcReviewDemand),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue(baseDemand),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([{ areaId: AREA_ID, scopeType: 'area' }]),
        findFirst: jest.fn().mockResolvedValue({ userId: DM_ID, areaIds: [], countryIds: [] }),
      },
      smallProjectArea: { findUnique: jest.fn().mockResolvedValue({ name: 'Test Area' }) },
      project: { create: jest.fn().mockResolvedValue({ id: 'project-cuid-1', demandId: DEMAND_ID }) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      financialPlanEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { valueCents: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      demandMilestone: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        DemandsService,
        DemandWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: SystemConfigService, useValue: { getAll: jest.fn().mockResolvedValue(DEFAULT_SYSTEM_CONFIG) } },
        { provide: FlagService, useValue: flagService },
      ],
    }).compile();

    service = module.get(DemandsService);
  });

  // ── dmAccept() (AC-1) ────────────────────────────────────────────────────

  describe('dmAccept()', () => {
    it('always routes to BC_REVIEW', async () => {
      const submittedDemand = { ...baseDemand, status: DemandStatus.SUBMITTED, areaId: AREA_ID };
      prisma.demand.findUniqueOrThrow.mockResolvedValue(submittedDemand);
      prisma.demand.update.mockResolvedValue({ ...submittedDemand, status: DemandStatus.BC_REVIEW });

      await service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' });

      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DemandStatus.BC_REVIEW }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'DM_ACCEPTED_TO_BC' }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(DEMAND_EVENTS.BC_REVIEW_STARTED, expect.anything());
    });
  });

  // ── getBcQueue() (AC-2) ────────────────────────────────────────────────────

  describe('getBcQueue()', () => {
    it('returns only BC_REVIEW demands scoped to the BC user', async () => {
      prisma.demand.findMany.mockResolvedValue([{
        ...bcReviewDemand,
        originator:         { name: 'Test Requester' },
        businessController: { name: 'Test BC' },
      }]);

      const result = await service.getBcQueue(BC_ID);

      expect(prisma.demand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessControllerId: BC_ID, status: DemandStatus.BC_REVIEW },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(DEMAND_ID);
    });

    it('returns empty array when no demands in queue', async () => {
      prisma.demand.findMany.mockResolvedValue([]);
      const result = await service.getBcQueue(BC_ID);
      expect(result).toEqual([]);
    });
  });

  // ── bcApprove() (AC-5) ────────────────────────────────────────────────────

  describe('bcApprove()', () => {
    it('transitions demand to IN_REVIEW and emits BC_APPROVED event', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(bcReviewDemand);
      prisma.demand.update.mockResolvedValue({ ...bcReviewDemand, status: DemandStatus.IN_REVIEW });

      await service.bcApprove(DEMAND_ID, BC_ID);

      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DemandStatus.IN_REVIEW,
            bcStatus: 'APPROVED',
            bcActionedBy: BC_ID,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'BC_APPROVED' }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(DEMAND_EVENTS.BC_APPROVED, expect.anything());
    });

    it('throws ForbiddenException when BC is not the assigned controller (AC-11 scope)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...bcReviewDemand,
        businessControllerId: 'other-bc-cuid',
      });

      await expect(service.bcApprove(DEMAND_ID, BC_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── bcReject() (AC-6) ─────────────────────────────────────────────────────

  describe('bcReject()', () => {
    it('transitions demand to REJECTED and emits BC_REJECTED event', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(bcReviewDemand);
      prisma.demand.update.mockResolvedValue({ ...bcReviewDemand, status: DemandStatus.REJECTED });

      await service.bcReject(DEMAND_ID, BC_ID, { commentary: 'Not aligned with strategy' });

      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DemandStatus.REJECTED,
            bcStatus: 'REJECTED',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'BC_REJECTED' }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(DEMAND_EVENTS.BC_REJECTED, expect.anything());
    });

    it('throws ForbiddenException when BC is not the assigned controller', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...bcReviewDemand,
        businessControllerId: 'other-bc-cuid',
      });

      await expect(
        service.bcReject(DEMAND_ID, BC_ID, { commentary: 'reason' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── bcSendToRequester() (AC-7) ────────────────────────────────────────────

  describe('bcSendToRequester()', () => {
    it('transitions demand to REROUTED and emits BC_REROUTED_TO_REQUESTER event', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(bcReviewDemand);
      prisma.demand.update.mockResolvedValue({ ...bcReviewDemand, status: DemandStatus.REROUTED });

      await service.bcSendToRequester(DEMAND_ID, BC_ID, { commentary: 'Please revise budget' });

      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DemandStatus.REROUTED,
            bcStatus: 'REROUTED_TO_REQUESTER',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'BC_REROUTED_TO_REQUESTER' }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(DEMAND_EVENTS.BC_REROUTED_TO_REQUESTER, expect.anything());
    });

    it('throws ForbiddenException when BC is not the assigned controller', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...bcReviewDemand,
        businessControllerId: 'other-bc-cuid',
      });

      await expect(
        service.bcSendToRequester(DEMAND_ID, BC_ID, { commentary: 'reason' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
