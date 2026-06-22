import { BadRequestException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { DemandsService } from '../../src/demands/demands.service';
import { DemandWorkflowService } from '../../src/demands/demand-workflow.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SystemConfigService } from '../../src/config/system-config.service';
import { FlagService } from '../../src/config/flag.service';
import { DemandStatus } from '@helix/shared';
import { Role } from '@helix/types';

const ORIGINATOR_ID = 'originator-cuid-1';
const OTHER_USER_ID = 'other-user-cuid-2';
const DEMAND_ID = 'demand-cuid-1';

const baseDemand = {
  id: DEMAND_ID,
  publicId: 1,
  title: 'Test Demand',
  description: 'A demand for testing',
  status: DemandStatus.DRAFT,
  originatorId: ORIGINATOR_ID,
  costCentreId: null,
  glAccountId: null,
  startDate: null,
  endDate: null,
  draftSavedAt: new Date('2026-07-01T00:00:00.000Z'),
  businessControllerId: null,
  bcStatus: null,
  bcActionedAt: null,
  bcActionedBy: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  legalEntityId: null,
  areaId: null,
  demandManagerId: null,
  demandOwner: null,
  objective: null,
  necessity: null,
  isMandatory: false,
  qualitativeValueCategory: null,
  quantitativeValueCategory: null,
  asisDescription: null,
  benefitsObjectives: null,
  tobeDescription: null,
  isSmallProject: false,
  isGxpRelevant: false,
  submittedAt: null,
  statusChangedAt: null,
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
  countryId: null,
};

const p2025 = () =>
  new PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '6.0.0',
  });

const DM_ID = 'dm-user-cuid-1';
const PM_ID = 'pm-user-cuid-1';
const ASSIGNED_PM_ID = 'assigned-pm-cuid-1';
const COST_CENTRE_ID = 'cc-cuid-1';
const AREA_ID = 'area-cuid-1';

const submittedDemand = {
  ...baseDemand,
  status: DemandStatus.SUBMITTED,
  areaId: AREA_ID,
  costCentreId: COST_CENTRE_ID,
  demandManagerId: 'person-cuid-1',
};

const inReviewDemand = {
  ...baseDemand,
  status: DemandStatus.IN_REVIEW,
  areaId: AREA_ID,
  costCentreId: COST_CENTRE_ID,
  demandManagerId: 'person-cuid-1',
  pmCommentary: null,
  pmActionedBy: null,
  pmActionedAt: null,
};

const DEFAULT_SYSTEM_CONFIG = {
  spThresholdEurCents:   5_000_000,
  intakeWindowStart:     null,
  intakeWindowEnd:       null,
  budgetCycleStart:      null,
  budgetCycleEnd:        null,
  gxpItValidationDays:   30,
  gxpDocumentationDays:  14,
};

describe('DemandsService', () => {
  let service: DemandsService;
  let eventEmitter: { emit: jest.Mock };
  let systemConfigService: { getAll: jest.Mock };
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
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    userRoleAssignment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    project: {
      create: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
    financialPlanEntry: {
      aggregate: jest.Mock;
      findMany: jest.Mock;
    };
    projectFinancialPlanEntry: {
      createMany: jest.Mock;
    };
    demandMilestone: {
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    smallProjectArea: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    eventEmitter = { emit: jest.fn() };
    systemConfigService = { getAll: jest.fn().mockResolvedValue(DEFAULT_SYSTEM_CONFIG) };

    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: DEMAND_ID }]),
      demand: {
        create: jest.fn().mockResolvedValue(baseDemand),
        update: jest.fn().mockResolvedValue(submittedDemand),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseDemand),
        findMany: jest.fn().mockResolvedValue([baseDemand]),
        delete: jest.fn().mockResolvedValue(baseDemand),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        // Default: DM has AREA_ID in areaIds, no country restriction, and userId for routing
        findFirst: jest.fn().mockResolvedValue({ userId: 'person-cuid-1', areaIds: [AREA_ID], countryIds: [] }),
      },
      smallProjectArea: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Test Area' }),
      },
      project: {
        create: jest.fn().mockResolvedValue({ id: 'project-cuid-1', demandId: DEMAND_ID }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      financialPlanEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { valueCents: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      projectFinancialPlanEntry: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      demandMilestone: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        DemandsService,
        DemandWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: SystemConfigService, useValue: systemConfigService },
        { provide: FlagService, useValue: { get: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    service = module.get(DemandsService);
  });

  describe('createDraft()', () => {
    it('creates demand with DRAFT status and sets draftSavedAt', async () => {
      await service.createDraft(
        { title: 'Test Demand', description: 'A demand for testing' },
        ORIGINATOR_ID,
      );
      expect(prisma.demand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DemandStatus.DRAFT,
            originatorId: ORIGINATOR_ID,
            draftSavedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('maps date strings to Date objects', async () => {
      await service.createDraft(
        {
          title: 'Test',
          description: 'Desc',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
        },
        ORIGINATOR_ID,
      );
      expect(prisma.demand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-12-31'),
          }),
        }),
      );
    });

    it('writes audit log in the same transaction', async () => {
      await service.createDraft(
        { title: 'Test', description: 'Desc' },
        ORIGINATOR_ID,
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'Demand',
            eventType: 'DRAFT_CREATED',
            changedBy: ORIGINATOR_ID,
          }),
        }),
      );
    });

    it('throws BadRequestException when endDate is before startDate', async () => {
      await expect(
        service.createDraft(
          { title: 'T', description: 'D', startDate: '2026-12-31', endDate: '2026-07-01' },
          ORIGINATOR_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateDraft()', () => {
    it('throws NotFoundException when demand does not exist', async () => {
      prisma.demand.findUniqueOrThrow.mockRejectedValue(p2025());
      await expect(
        service.updateDraft(DEMAND_ID, { title: 'New' }, ORIGINATOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not the originator', async () => {
      await expect(
        service.updateDraft(DEMAND_ID, { title: 'New' }, OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when demand is not in DRAFT status', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand,
        status: DemandStatus.SUBMITTED,
      });
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.updateDraft(DEMAND_ID, { title: 'New' }, ORIGINATOR_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates draftSavedAt on each patch', async () => {
      await service.updateDraft(DEMAND_ID, { title: 'Updated' }, ORIGINATOR_ID);
      expect(prisma.demand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ draftSavedAt: expect.any(Date) }),
        }),
      );
    });

    it('writes audit log in the same transaction', async () => {
      await service.updateDraft(DEMAND_ID, { title: 'Updated' }, ORIGINATOR_ID);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'Demand',
            eventType: 'DRAFT_UPDATED',
            changedBy: ORIGINATOR_ID,
          }),
        }),
      );
    });

    it('throws BadRequestException when endDate is before startDate', async () => {
      await expect(
        service.updateDraft(
          DEMAND_ID,
          { startDate: '2026-12-31', endDate: '2026-07-01' },
          ORIGINATOR_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne()', () => {
    it('returns demand for the originator', async () => {
      const result = await service.findOne(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result.id).toBe(DEMAND_ID);
    });

    it('throws NotFoundException for non-owner DemandRequester (avoids existence leak)', async () => {
      await expect(
        service.findOne(DEMAND_ID, OTHER_USER_ID, [Role.DemandRequester]),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows DemandManager to view any demand', async () => {
      const result = await service.findOne(DEMAND_ID, OTHER_USER_ID, [Role.DemandManager]);
      expect(result.id).toBe(DEMAND_ID);
    });

    it('allows PortfolioManager to view any demand', async () => {
      const result = await service.findOne(DEMAND_ID, OTHER_USER_ID, [Role.PortfolioManager]);
      expect(result.id).toBe(DEMAND_ID);
    });

    it('throws NotFoundException when demand missing', async () => {
      prisma.demand.findUniqueOrThrow.mockRejectedValue(new Error('not found'));
      await expect(
        service.findOne(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll()', () => {
    it('filters by originatorId for DemandRequester', async () => {
      await service.findAll(ORIGINATOR_ID, [Role.DemandRequester]);
      expect(prisma.demand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { originatorId: ORIGINATOR_ID } }),
      );
    });

    it('returns all demands for DemandManager', async () => {
      await service.findAll(OTHER_USER_ID, [Role.DemandManager]);
      expect(prisma.demand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('returns all demands for PortfolioManager', async () => {
      await service.findAll(OTHER_USER_ID, [Role.PortfolioManager]);
      expect(prisma.demand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });
  });

  describe('Story 2.2 — new fields in createDraft / updateDraft / toResponse', () => {
    it('createDraft sets isMandatory=false when not provided', async () => {
      await service.createDraft({ title: 'Test', description: 'Desc' }, ORIGINATOR_ID);
      expect(prisma.demand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isMandatory: false }),
        }),
      );
    });

    it('createDraft persists all 12 new fields when provided', async () => {
      await service.createDraft(
        {
          title: 'T', description: 'D',
          legalEntityId: 'le-1', areaId: 'area-1', demandManagerId: 'mgr-1',
          demandOwner: 'Jane', objective: 'Obj', necessity: 'Nec',
          isMandatory: true,
          qualitativeValueCategory: true,
          quantitativeValueCategory: false,
          asisDescription: 'As-is', benefitsObjectives: 'Benefits', tobeDescription: 'To-be',
        },
        ORIGINATOR_ID,
      );
      expect(prisma.demand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legalEntityId: 'le-1',
            areaId: 'area-1',
            demandManagerId: 'mgr-1',
            demandOwner: 'Jane',
            objective: 'Obj',
            necessity: 'Nec',
            isMandatory: true,
            qualitativeValueCategory: true,
            quantitativeValueCategory: false,
            asisDescription: 'As-is',
            benefitsObjectives: 'Benefits',
            tobeDescription: 'To-be',
          }),
        }),
      );
    });

    it('updateDraft patches objective when provided', async () => {
      await service.updateDraft(DEMAND_ID, { objective: 'New objective' }, ORIGINATOR_ID);
      expect(prisma.demand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ objective: 'New objective' }),
        }),
      );
    });

    it('createDraft persists businessControllerId when provided', async () => {
      await service.createDraft(
        { title: 'T', description: 'D', businessControllerId: 'bc-cuid-1' },
        ORIGINATOR_ID,
      );
      expect(prisma.demand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ businessControllerId: 'bc-cuid-1' }),
        }),
      );
    });

    it('createDraft stores null when businessControllerId is omitted', async () => {
      await service.createDraft({ title: 'T', description: 'D' }, ORIGINATOR_ID);
      expect(prisma.demand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ businessControllerId: null }),
        }),
      );
    });

    it('updateDraft patches businessControllerId when provided', async () => {
      await service.updateDraft(DEMAND_ID, { businessControllerId: 'bc-cuid-1' }, ORIGINATOR_ID);
      expect(prisma.demand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ businessControllerId: 'bc-cuid-1' }),
        }),
      );
    });

    it('toResponse maps all 12 new fields', async () => {
      const withFields = {
        ...baseDemand,
        legalEntityId: 'le-1',
        areaId: 'area-1',
        demandManagerId: 'mgr-1',
        demandOwner: 'Jane',
        objective: 'Obj',
        necessity: 'Nec',
        isMandatory: true,
        qualitativeValueCategory: 'Strategic',
        quantitativeValueCategory: 'Cost',
        asisDescription: 'As-is',
        benefitsObjectives: 'Benefits',
        tobeDescription: 'To-be',
      };
      prisma.demand.findUniqueOrThrow.mockResolvedValue(withFields);
      const result = await service.findOne(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result.legalEntityId).toBe('le-1');
      expect(result.areaId).toBe('area-1');
      expect(result.demandManagerId).toBe('mgr-1');
      expect(result.demandOwner).toBe('Jane');
      expect(result.objective).toBe('Obj');
      expect(result.necessity).toBe('Nec');
      expect(result.isMandatory).toBe(true);
      expect(result.qualitativeValueCategory).toBe('Strategic');
      expect(result.quantitativeValueCategory).toBe('Cost');
      expect(result.asisDescription).toBe('As-is');
      expect(result.benefitsObjectives).toBe('Benefits');
      expect(result.tobeDescription).toBe('To-be');
    });
  });

  describe('submitDemand()', () => {
    beforeEach(() => {
      // submitDemand requires areaId for DM routing
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...baseDemand, areaId: AREA_ID });
    });

    it('transitions DRAFT to SUBMITTED and sets submittedAt', async () => {
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      expect(prisma.demand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DEMAND_ID, status: { in: [DemandStatus.DRAFT, DemandStatus.REROUTED] } },
          data: expect.objectContaining({
            status: DemandStatus.SUBMITTED,
            submittedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('transitions REROUTED to SUBMITTED (resubmit after DM reroute)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand, areaId: AREA_ID, status: DemandStatus.REROUTED,
      });
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      expect(prisma.demand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DEMAND_ID, status: { in: [DemandStatus.DRAFT, DemandStatus.REROUTED] } },
          data: expect.objectContaining({ status: DemandStatus.SUBMITTED }),
        }),
      );
    });

    it('throws BadRequestException when demand is not DRAFT (updateMany returns count 0)', async () => {
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.submitDemand(DEMAND_ID, ORIGINATOR_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when requester is not the originator', async () => {
      await expect(
        service.submitDemand(DEMAND_ID, OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when demand not found', async () => {
      prisma.$queryRaw.mockResolvedValue([]);  // withDemandLock throws NotFoundException when lock row is absent
      await expect(
        service.submitDemand(DEMAND_ID, ORIGINATOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('writes DEMAND_SUBMITTED audit log in the same transaction', async () => {
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'Demand',
            eventType: 'DEMAND_SUBMITTED',
            changedBy: ORIGINATOR_ID,
            before: { status: DemandStatus.DRAFT },
            after: expect.objectContaining({ status: DemandStatus.SUBMITTED }),
          }),
        }),
      );
    });

    it('sets submittedAt to server-side timestamp', async () => {
      const before = new Date();
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      const call = prisma.demand.updateMany.mock.calls[0][0];
      expect(call.data.submittedAt).toBeInstanceOf(Date);
      expect(call.data.submittedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('auto-sets startDate to submittedAt when startDate is null', async () => {
      const before = new Date();
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      const call = prisma.demand.updateMany.mock.calls[0][0];
      expect(call.data.startDate).toBeInstanceOf(Date);
      expect(call.data.startDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('preserves existing startDate when already set', async () => {
      const existingStart = new Date('2026-01-15');
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand, areaId: AREA_ID, startDate: existingStart,
      });
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      const call = prisma.demand.updateMany.mock.calls[0][0];
      expect(call.data.startDate).toEqual(existingStart);
    });
  });

  describe('Story 3.3 — intake window, SP threshold, GxP milestones', () => {
    const demandWithDm = { ...baseDemand, areaId: AREA_ID, isGxpRelevant: false };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(demandWithDm);
    });

    it('throws INTAKE_CLOSED when now is before intakeWindowStart', async () => {
      const futureOpen = new Date(Date.now() + 86_400_000).toISOString();
      systemConfigService.getAll.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        intakeWindowStart: futureOpen,
        intakeWindowEnd: null,
      });
      await expect(service.submitDemand(DEMAND_ID, ORIGINATOR_ID)).rejects.toThrow(UnprocessableEntityException);
      try {
        await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      } catch (e) {
        if (e instanceof UnprocessableEntityException) {
          expect((e.getResponse() as { code: string }).code).toBe('INTAKE_CLOSED');
        }
      }
    });

    it('throws INTAKE_CLOSED when now is after intakeWindowEnd', async () => {
      const pastClose = new Date(Date.now() - 86_400_000).toISOString();
      systemConfigService.getAll.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        intakeWindowStart: null,
        intakeWindowEnd: pastClose,
      });
      await expect(service.submitDemand(DEMAND_ID, ORIGINATOR_ID)).rejects.toThrow(UnprocessableEntityException);
      try {
        await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      } catch (e) {
        if (e instanceof UnprocessableEntityException) {
          expect((e.getResponse() as { code: string }).code).toBe('INTAKE_CLOSED');
        }
      }
    });

    it('succeeds when both intake window dates are null (always open)', async () => {
      systemConfigService.getAll.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        intakeWindowStart: null,
        intakeWindowEnd: null,
      });
      await expect(service.submitDemand(DEMAND_ID, ORIGINATOR_ID)).resolves.toBeDefined();
    });

    it('creates two DemandMilestone records when isGxpRelevant is true (NFR14)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...demandWithDm, isGxpRelevant: true });
      systemConfigService.getAll.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        gxpItValidationDays: 45,
        gxpDocumentationDays: 20,
      });
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      expect(prisma.demandMilestone.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ milestoneType: 'IT_VALIDATION',  durationDays: 45 }),
            expect.objectContaining({ milestoneType: 'DOCUMENTATION',  durationDays: 20 }),
          ]),
          skipDuplicates: true,
        }),
      );
    });

    it('milestone durationDays reflect the configured values (NFR14)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...demandWithDm, isGxpRelevant: true });
      systemConfigService.getAll.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        gxpItValidationDays: 60,
        gxpDocumentationDays: 7,
      });
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      const call = prisma.demandMilestone.createMany.mock.calls[0][0];
      const itVal = call.data.find((d: { milestoneType: string }) => d.milestoneType === 'IT_VALIDATION');
      const doc   = call.data.find((d: { milestoneType: string }) => d.milestoneType === 'DOCUMENTATION');
      expect(itVal.durationDays).toBe(60);
      expect(doc.durationDays).toBe(7);
    });

    it('does NOT create milestones when isGxpRelevant is false', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...demandWithDm, isGxpRelevant: false });
      await service.submitDemand(DEMAND_ID, ORIGINATOR_ID);
      expect(prisma.demandMilestone.createMany).not.toHaveBeenCalled();
    });
  });

  describe('Story 2.4 — classification + GxP fields in toResponse()', () => {
    it('toResponse returns projectType "SP" when isSmallProject is true', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand,
        isSmallProject: true,
      });
      const result = await service.findOne(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result.projectType).toBe('SP');
    });

    it('toResponse returns projectType "P" when isSmallProject is false', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand,
        isSmallProject: false,
      });
      const result = await service.findOne(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result.projectType).toBe('P');
    });

    it('toResponse maps isSmallProject correctly', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand,
        isSmallProject: true,
      });
      const result = await service.findOne(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result.isSmallProject).toBe(true);
    });

    it('toResponse maps isGxpRelevant correctly', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand,
        isGxpRelevant: true,
      });
      const result = await service.findOne(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result.isGxpRelevant).toBe(true);
    });
  });

  // ── Story 3.10 — Multi-Area + Country Scoping ────────────────────────────────

  describe('Story 3.10 — validateDmScope() multi-area + country', () => {
    const COUNTRY_ID = 'country-cuid-1';
    const OTHER_COUNTRY_ID = 'country-cuid-2';
    const baseDmAcceptDemand = { ...submittedDemand, businessControllerId: 'bc-user-cuid-1', areaId: AREA_ID };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(baseDmAcceptDemand);
      prisma.demand.update.mockResolvedValue({ ...baseDmAcceptDemand, status: DemandStatus.BC_REVIEW });
    });

    it('global DM (empty areaIds) — passes scope check regardless of demand area', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [], countryIds: [] });
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).resolves.toBeDefined();
    });

    it('area-scoped DM with matching area — passes scope check', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [] });
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).resolves.toBeDefined();
    });

    it('area-scoped DM with non-matching area — throws ForbiddenException', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).rejects.toThrow(ForbiddenException);
    });

    it('area+country DM with matching area and country — passes scope check', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...baseDmAcceptDemand, countryId: COUNTRY_ID });
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [COUNTRY_ID] });
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).resolves.toBeDefined();
    });

    it('area+country DM with matching area but wrong country — throws ForbiddenException', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...baseDmAcceptDemand, countryId: OTHER_COUNTRY_ID });
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [COUNTRY_ID] });
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).rejects.toThrow(ForbiddenException);
    });

    it('area+country DM with matching area and null demand countryId — throws ForbiddenException (AC-6)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...baseDmAcceptDemand, countryId: null });
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [COUNTRY_ID] });
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 3.10 — submitDemand() routing — multi-area + country', () => {
    const COUNTRY_ID = 'country-cuid-1';

    it('global DM (empty areaIds) — is selected as DM regardless of demand area (AC-4)', async () => {
      const demand = { ...baseDemand, areaId: AREA_ID, countryId: null, originatorId: ORIGINATOR_ID, status: DemandStatus.DRAFT };
      prisma.demand.findUniqueOrThrow.mockResolvedValue(demand);
      // submitDemand calls findFirst once for DM routing (returns userId), once via findUniqueOrThrow from lock
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: 'dm-global-id', areaIds: [], countryIds: [] });
      await expect(service.submitDemand(DEMAND_ID, ORIGINATOR_ID)).resolves.toBeDefined();
      expect(prisma.demand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ demandManagerId: 'dm-global-id' }),
        }),
      );
    });

    it('area+country DM with no match — throws NO_DM_CONFIGURED (AC-6)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...baseDemand, areaId: AREA_ID, countryId: COUNTRY_ID, originatorId: ORIGINATOR_ID, status: DemandStatus.DRAFT,
      });
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.submitDemand(DEMAND_ID, ORIGINATOR_ID)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('Story 4.1 — getDmQueue()', () => {
    beforeEach(() => {
      prisma.demand.findMany.mockResolvedValue([{
        ...submittedDemand,
        statusChangedAt: new Date(Date.now() - 3 * 86_400_000),
        updatedAt: new Date(Date.now() - 10 * 86_400_000),
        originator:    { name: 'Test Requester' },
        demandManager: { name: 'Test DM' },
      }]);
    });

    it('returns empty array when DM has no role assignment', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      const result = await service.getDmQueue(DM_ID);
      expect(result).toHaveLength(0);
      expect(prisma.demand.findMany).not.toHaveBeenCalled();
    });

    it('queries demands scoped to DM areas (area-scoped DM)', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [] });
      await service.getDmQueue(DM_ID);
      expect(prisma.demand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ areaId: { in: [AREA_ID] } }),
        }),
      );
    });

    it('global DM (empty areaIds) sees all demands — no area filter applied', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [], countryIds: [] });
      await service.getDmQueue(DM_ID);
      const callArgs = prisma.demand.findMany.mock.calls[0][0];
      expect(callArgs.where.areaId).toBeUndefined();
    });

    it('applies countryId filter when DM has both area and country scope', async () => {
      const COUNTRY_ID = 'country-cuid-1';
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [COUNTRY_ID] });
      await service.getDmQueue(DM_ID);
      const callArgs = prisma.demand.findMany.mock.calls[0][0];
      expect(callArgs.where.countryId).toEqual({ in: [COUNTRY_ID] });
    });

    it('returns queue items with stalledDays computed', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [] });
      const result = await service.getDmQueue(DM_ID);
      expect(result[0].stalledDays).toBe(3);
    });

    it('passes statusChangedAt OR updatedAt cutoff filter to findMany when stalledOnly is set', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ areaIds: [AREA_ID], countryIds: [] });
      await service.getDmQueue(DM_ID, { stalledOnly: true });
      const callArgs = prisma.demand.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.OR[0].statusChangedAt.lte).toBeInstanceOf(Date);
      expect(callArgs.where.OR[1].statusChangedAt).toBeNull();
      expect(callArgs.where.OR[1].updatedAt.lte).toBeInstanceOf(Date);
    });
  });

  describe('Story 4.1 — dmAccept()', () => {
    const dmAcceptDemand = { ...submittedDemand, businessControllerId: 'bc-user-cuid-1' };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(dmAcceptDemand);
      prisma.demand.update.mockResolvedValue({ ...dmAcceptDemand, status: DemandStatus.BC_REVIEW });
    });

    it('transitions demand to BC_REVIEW and writes audit log last', async () => {
      await service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DemandStatus.BC_REVIEW, dmDecision: 'ACCEPT' }) }),
      );
      const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
      const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
      expect(auditCall).toBeGreaterThan(updateCall);
    });

    it('emits BC_REVIEW_STARTED event after the transaction', async () => {
      await service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.bcReviewStarted', expect.objectContaining({ demandId: DEMAND_ID }));
    });

    it('throws ForbiddenException when demand is outside DM scope', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when demand is an SP demand (must use sp-accept instead)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...dmAcceptDemand, isSmallProject: true });
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no Business Controller is assigned', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...submittedDemand, businessControllerId: null });
      await expect(service.dmAccept(DEMAND_ID, DM_ID, { fundingType: 'Business' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Story 4.1 — dmReturn()', () => {
    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(submittedDemand);
      prisma.demand.update.mockResolvedValue({ ...submittedDemand, status: DemandStatus.REROUTED });
    });

    it('transitions demand to REROUTED and stores dmCommentary', async () => {
      await service.dmReturn(DEMAND_ID, DM_ID, { fundingType: 'Business', dmCommentary: 'Missing details' });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DemandStatus.REROUTED, dmCommentary: 'Missing details' }) }),
      );
    });

    it('emits DM_REROUTED event', async () => {
      await service.dmReturn(DEMAND_ID, DM_ID, { fundingType: 'Business', dmCommentary: 'Fix it' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.dmRerouted', expect.any(Object));
    });

    it('throws ForbiddenException when demand is outside DM scope', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.dmReturn(DEMAND_ID, DM_ID, { fundingType: 'Business', dmCommentary: 'x' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.1 — dmReject()', () => {
    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(submittedDemand);
      prisma.demand.update.mockResolvedValue({ ...submittedDemand, status: DemandStatus.REJECTED });
    });

    it('transitions demand to REJECTED and stores dmCommentary', async () => {
      await service.dmReject(DEMAND_ID, DM_ID, { fundingType: 'Business', dmCommentary: 'Not aligned' });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DemandStatus.REJECTED, dmCommentary: 'Not aligned' }) }),
      );
    });

    it('emits DM_REJECTED event', async () => {
      await service.dmReject(DEMAND_ID, DM_ID, { fundingType: 'Business', dmCommentary: 'Not aligned' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.dmRejected', expect.any(Object));
    });

    it('throws ForbiddenException when demand is outside DM scope', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.dmReject(DEMAND_ID, DM_ID, { fundingType: 'Business', dmCommentary: 'x' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.1 — dmPostpone()', () => {
    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(submittedDemand);
      prisma.demand.update.mockResolvedValue({ ...submittedDemand, status: DemandStatus.ON_HOLD });
    });

    it('transitions demand to ON_HOLD and stores onHoldReason', async () => {
      await service.dmPostpone(DEMAND_ID, DM_ID, { onHoldReason: 'Budget freeze' });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DemandStatus.ON_HOLD, onHoldReason: 'Budget freeze' }) }),
      );
    });

    it('does NOT emit any event (no email for postpone)', async () => {
      await service.dmPostpone(DEMAND_ID, DM_ID, { onHoldReason: 'Budget freeze' });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when demand is outside DM scope', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.dmPostpone(DEMAND_ID, DM_ID, { onHoldReason: 'x' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.2 — pmApprove()', () => {
    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(inReviewDemand);
      prisma.demand.update.mockResolvedValue({ ...inReviewDemand, status: DemandStatus.APPROVED });
      prisma.userRoleAssignment.findMany.mockResolvedValue([
        { scopeType: 'cost_centre', scopeId: COST_CENTRE_ID },
      ]);
    });

    it('transitions demand to APPROVED and creates project stub', async () => {
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DemandStatus.APPROVED, pmActionedBy: PM_ID }) }),
      );
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ demandId: DEMAND_ID }) }),
      );
    });

    it('writes audit log as last action in transaction', async () => {
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
      const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
      expect(auditCall).toBeGreaterThan(updateCall);
    });

    it('emits PM_APPROVED event after the transaction', async () => {
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.pmApproved', expect.objectContaining({ demandId: DEMAND_ID }));
    });

    it('throws ForbiddenException when PM has no assignment', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([]);
      await expect(service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID })).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when demand cost centre is outside PM scope', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([
        { scopeType: 'cost_centre', scopeId: 'different-cc-id' },
      ]);
      await expect(service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID })).rejects.toThrow(ForbiddenException);
    });

    it('global PM can approve any demand regardless of cost centre', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([
        { scopeType: 'global', scopeId: null },
      ]);
      await expect(service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID })).resolves.toBeDefined();
    });

    it('Story 4.18 — throws BadRequestException when assignedPmId user lacks ProjectManager role', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID })).rejects.toThrow(BadRequestException);
    });

    it('Story 4.18 — stores assignedPmId on the created project stub', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: ASSIGNED_PM_ID });
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ demandId: DEMAND_ID, assignedPmId: ASSIGNED_PM_ID }) }),
      );
    });

    it('Story 6.1 — sets status = DRAFT on created project', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: ASSIGNED_PM_ID });
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) }),
      );
    });

    it('Story 6.6 — snapshot-copies charter fields from demand into project.create', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: ASSIGNED_PM_ID });
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            objective: null,
            necessity: null,
            gxpRelevant: false,
            eaInvolved: null,
            eaComment: null,
            itSecurityInvolved: null,
            itSecurityComment: null,
          }),
        }),
      );
    });

    it('Story 6.1 — writes project audit log after demand audit log with DRAFT status', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: ASSIGNED_PM_ID });
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
      const calls = prisma.auditLog.create.mock.calls;
      const demandAudit = calls.find((c: unknown[]) => (c[0] as { data: { entityType: string } }).data.entityType === 'Demand');
      const projectAudit = calls.find((c: unknown[]) => (c[0] as { data: { entityType: string } }).data.entityType === 'Project');
      expect(demandAudit).toBeDefined();
      expect(projectAudit).toBeDefined();
      expect((projectAudit![0] as { data: { eventType: string; after: { status: string } } }).data.eventType).toBe('PROJECT_CREATED');
      expect((projectAudit![0] as { data: { after: { status: string } } }).data.after).toMatchObject({ status: 'DRAFT' });
    });

    it('Story 6.9 — copies demand FP entries into projectFinancialPlanEntry when entries exist', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: ASSIGNED_PM_ID });
      const fpEntries = [
        { glAccountId: 'gl-1', category: 'opex', month: 1, year: 2026, valueCents: 10000, isActual: false, isUserSet: true },
        { glAccountId: 'gl-2', category: 'capex', month: 2, year: 2026, valueCents: 20000, isActual: false, isUserSet: false },
      ];
      prisma.financialPlanEntry.findMany.mockResolvedValue(fpEntries);
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(prisma.projectFinancialPlanEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ glAccountId: 'gl-1', category: 'opex', valueCents: 10000 }),
            expect.objectContaining({ glAccountId: 'gl-2', category: 'capex', valueCents: 20000 }),
          ]),
        }),
      );
    });

    it('Story 6.9 — skips createMany when demand has zero FP entries', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: ASSIGNED_PM_ID });
      prisma.financialPlanEntry.findMany.mockResolvedValue([]);
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      expect(prisma.projectFinancialPlanEntry.createMany).not.toHaveBeenCalled();
    });

    it('Story 6.9 — PROJECT_CREATED audit log includes financialEntriesCopied count', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ scopeType: 'cost_centre', scopeId: COST_CENTRE_ID }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue({ userId: ASSIGNED_PM_ID });
      const fpEntries = [
        { glAccountId: 'gl-1', category: 'opex', month: 1, year: 2026, valueCents: 10000, isActual: false, isUserSet: true },
      ];
      prisma.financialPlanEntry.findMany.mockResolvedValue(fpEntries);
      await service.pmApprove(DEMAND_ID, PM_ID, { assignedPmId: ASSIGNED_PM_ID });
      const calls = prisma.auditLog.create.mock.calls;
      const projectAudit = calls.find((c: unknown[]) => (c[0] as { data: { entityType: string } }).data.entityType === 'Project');
      expect((projectAudit![0] as { data: { after: { financialEntriesCopied: number } } }).data.after).toMatchObject({ financialEntriesCopied: 1 });
    });
  });

  describe('Story 4.2 — pmReject()', () => {
    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(inReviewDemand);
      prisma.demand.update.mockResolvedValue({ ...inReviewDemand, status: DemandStatus.REJECTED });
      prisma.userRoleAssignment.findMany.mockResolvedValue([
        { scopeType: 'cost_centre', scopeId: COST_CENTRE_ID },
      ]);
    });

    it('transitions demand to REJECTED and stores pmCommentary', async () => {
      await service.pmReject(DEMAND_ID, PM_ID, { pmCommentary: 'Not aligned with strategy' });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DemandStatus.REJECTED, pmCommentary: 'Not aligned with strategy' }) }),
      );
    });

    it('emits PM_REJECTED event after the transaction', async () => {
      await service.pmReject(DEMAND_ID, PM_ID, { pmCommentary: 'Not aligned' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.pmRejected', expect.any(Object));
    });

    it('throws ForbiddenException when demand is outside PM scope', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([]);
      await expect(service.pmReject(DEMAND_ID, PM_ID, { pmCommentary: 'x' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.13 — pmSendBack()', () => {
    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(inReviewDemand);
      prisma.userRoleAssignment.findMany.mockResolvedValue([
        { scopeType: 'cost_centre', scopeId: COST_CENTRE_ID },
      ]);
    });

    describe('target = requester', () => {
      beforeEach(() => {
        prisma.demand.update.mockResolvedValue({ ...inReviewDemand, status: DemandStatus.REROUTED });
      });

      it('transitions demand to REROUTED, stores commentary, sets pmActionedBy/pmActionedAt, clears spStep', async () => {
        await service.pmSendBack(DEMAND_ID, PM_ID, { target: 'requester', commentary: 'Needs more detail' });
        expect(prisma.demand.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: DemandStatus.REROUTED,
              pmCommentary: 'Needs more detail',
              pmActionedBy: PM_ID,
              pmActionedAt: expect.any(Date),
              spStep: null,
            }),
          }),
        );
      });

      it('writes PM_SENT_TO_REQUESTER audit log as last action in transaction', async () => {
        await service.pmSendBack(DEMAND_ID, PM_ID, { target: 'requester', commentary: 'Needs more detail' });
        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ eventType: 'PM_SENT_TO_REQUESTER' }) }),
        );
        const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
        const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
        expect(auditCall).toBeGreaterThan(updateCall);
      });

      it('emits PM_SENT_TO_REQUESTER event after the transaction', async () => {
        await service.pmSendBack(DEMAND_ID, PM_ID, { target: 'requester', commentary: 'x' });
        expect(eventEmitter.emit).toHaveBeenCalledWith('demand.pmSentToRequester', expect.objectContaining({ demandId: DEMAND_ID }));
      });
    });

    describe('target = dm', () => {
      beforeEach(() => {
        prisma.demand.update.mockResolvedValue({ ...inReviewDemand, status: DemandStatus.SUBMITTED });
      });

      it('transitions demand to SUBMITTED, stores commentary, sets pmActionedBy/pmActionedAt, clears spStep', async () => {
        await service.pmSendBack(DEMAND_ID, PM_ID, { target: 'dm', commentary: 'Estimation incomplete' });
        expect(prisma.demand.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: DemandStatus.SUBMITTED,
              pmCommentary: 'Estimation incomplete',
              pmActionedBy: PM_ID,
              pmActionedAt: expect.any(Date),
              spStep: null,
            }),
          }),
        );
      });

      it('writes PM_SENT_TO_DM audit log as last action in transaction', async () => {
        await service.pmSendBack(DEMAND_ID, PM_ID, { target: 'dm', commentary: 'Estimation incomplete' });
        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ eventType: 'PM_SENT_TO_DM' }) }),
        );
        const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
        const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
        expect(auditCall).toBeGreaterThan(updateCall);
      });

      it('emits PM_SENT_TO_DM event after the transaction', async () => {
        await service.pmSendBack(DEMAND_ID, PM_ID, { target: 'dm', commentary: 'x' });
        expect(eventEmitter.emit).toHaveBeenCalledWith('demand.pmSentToDm', expect.objectContaining({ demandId: DEMAND_ID }));
      });
    });

    it('throws ForbiddenException when demand is outside PM scope', async () => {
      prisma.userRoleAssignment.findMany.mockResolvedValue([]);
      await expect(service.pmSendBack(DEMAND_ID, PM_ID, { target: 'requester', commentary: 'x' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.2 — getDemandHistory()', () => {
    const historyEntry = {
      id: 'audit-cuid-1',
      entityType: 'Demand',
      entityId: DEMAND_ID,
      eventType: 'DRAFT_CREATED',
      changedBy: ORIGINATOR_ID,
      changedAt: new Date('2026-07-01T00:00:00.000Z'),
      before: null,
      after: { status: DemandStatus.DRAFT },
    };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(baseDemand);
      prisma.auditLog.findMany.mockResolvedValue([historyEntry]);
      prisma.user.findMany.mockResolvedValue([{ id: ORIGINATOR_ID, name: 'Test User' }]);
    });

    it('returns history entries in chronological order with actor names', async () => {
      const result = await service.getDemandHistory(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'audit-cuid-1',
        eventType: 'DRAFT_CREATED',
        actorName: 'Test User',
        changedAt: '2026-07-01T00:00:00.000Z',
      });
    });

    it('falls back to changedBy ID when user not found', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const result = await service.getDemandHistory(DEMAND_ID, ORIGINATOR_ID, [Role.DemandRequester]);
      expect(result[0].actorName).toBe(ORIGINATOR_ID);
    });

    it('throws NotFoundException for non-existent demand', async () => {
      prisma.demand.findUniqueOrThrow.mockRejectedValue(new Error('Not found'));
      await expect(service.getDemandHistory('bad-id', ORIGINATOR_ID, [Role.DemandRequester])).rejects.toThrow(NotFoundException);
    });

    it('returns 404 for non-owner without manager role', async () => {
      await expect(
        service.getDemandHistory(DEMAND_ID, OTHER_USER_ID, [Role.DemandRequester]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Story 4.3 — SP Actions ──────────────────────────────────────────────────

  const spSubmittedDemand = {
    ...submittedDemand,
    isSmallProject: true,
    spStep: null,
    drCommentary: null,
    pmCommentary: null,
    pmActionedBy: null,
    pmActionedAt: null,
  };

  describe('Story 4.3 — spAccept()', () => {
    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(spSubmittedDemand);
      prisma.demand.update.mockResolvedValue({ ...spSubmittedDemand, spStep: 'DM_COST_ESTIMATION' });
    });

    it('sets spStep=DM_COST_ESTIMATION and dmDecision=ACCEPT without status change', async () => {
      await service.spAccept(DEMAND_ID, DM_ID);
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ spStep: 'DM_COST_ESTIMATION', dmDecision: 'ACCEPT' }),
        }),
      );
    });

    it('writes audit log with SP_DM_ACCEPTED event type last', async () => {
      await service.spAccept(DEMAND_ID, DM_ID);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'SP_DM_ACCEPTED' }) }),
      );
      const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
      const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
      expect(auditCall).toBeGreaterThan(updateCall);
    });

    it('emits SP_DM_ACCEPTED event after transaction (notifies Originator via handler)', async () => {
      await service.spAccept(DEMAND_ID, DM_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.spDmAccepted', expect.objectContaining({ demandId: DEMAND_ID }));
    });

    it('throws BadRequestException if demand is not SP', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...spSubmittedDemand, isSmallProject: false });
      await expect(service.spAccept(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if status is not SUBMITTED', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...spSubmittedDemand, status: DemandStatus.IN_REVIEW });
      await expect(service.spAccept(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if spStep is already set', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...spSubmittedDemand, spStep: 'DM_COST_ESTIMATION' });
      await expect(service.spAccept(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when demand is outside DM scope', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.spAccept(DEMAND_ID, DM_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.3 — spSubmitEstimate()', () => {
    const spCostEstimationDemand = { ...spSubmittedDemand, spStep: 'DM_COST_ESTIMATION' };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(spCostEstimationDemand);
      prisma.demand.update.mockResolvedValue({ ...spCostEstimationDemand, status: DemandStatus.SP_OFFER_REVIEW, spStep: 'DR_OFFER_REVIEW' });
      prisma.financialPlanEntry.findMany.mockResolvedValue([]);
    });

    it('transitions to SP_OFFER_REVIEW with spStep=DR_OFFER_REVIEW and clears drCommentary when no CAPEX entries', async () => {
      await service.spSubmitEstimate(DEMAND_ID, DM_ID);
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DemandStatus.SP_OFFER_REVIEW, spStep: 'DR_OFFER_REVIEW', drCommentary: null }),
        }),
      );
    });

    it('allows submission when CAPEX entries exist but valueCents=0', async () => {
      prisma.financialPlanEntry.findMany.mockResolvedValue([
        { category: 'capex', valueCents: 0 },
      ]);
      await expect(service.spSubmitEstimate(DEMAND_ID, DM_ID)).resolves.toBeDefined();
    });

    it('throws BadRequestException if spStep is not DM_COST_ESTIMATION', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...spCostEstimationDemand, spStep: null });
      await expect(service.spSubmitEstimate(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('writes audit log with SP_ESTIMATE_SUBMITTED event type last', async () => {
      await service.spSubmitEstimate(DEMAND_ID, DM_ID);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'SP_ESTIMATE_SUBMITTED' }) }),
      );
    });
  });

  describe('Story 4.3 — spAcceptOffer()', () => {
    const spOfferReviewDemand = {
      ...spSubmittedDemand,
      status: DemandStatus.SP_OFFER_REVIEW,
      spStep: 'DR_OFFER_REVIEW',
    };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(spOfferReviewDemand);
      prisma.demand.update.mockResolvedValue({ ...spOfferReviewDemand, status: DemandStatus.IN_REVIEW, spStep: 'PM_DECISION' });
    });

    it('transitions to IN_REVIEW and sets spStep=PM_DECISION', async () => {
      await service.spAcceptOffer(DEMAND_ID, ORIGINATOR_ID);
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DemandStatus.IN_REVIEW, spStep: 'PM_DECISION' }) }),
      );
    });

    it('throws ForbiddenException for non-originator', async () => {
      await expect(service.spAcceptOffer(DEMAND_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if demand is not at SP_OFFER_REVIEW', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...spOfferReviewDemand, status: DemandStatus.IN_REVIEW });
      await expect(service.spAcceptOffer(DEMAND_ID, ORIGINATOR_ID)).rejects.toThrow(BadRequestException);
    });

    it('writes audit log with SP_OFFER_ACCEPTED event type', async () => {
      await service.spAcceptOffer(DEMAND_ID, ORIGINATOR_ID);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'SP_OFFER_ACCEPTED' }) }),
      );
    });
  });

  describe('Story 4.3 — spReworkOffer()', () => {
    const spOfferReviewDemand = {
      ...spSubmittedDemand,
      status: DemandStatus.SP_OFFER_REVIEW,
      spStep: 'DR_OFFER_REVIEW',
    };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(spOfferReviewDemand);
      prisma.demand.update.mockResolvedValue({
        ...spOfferReviewDemand, status: DemandStatus.REROUTED, spStep: 'DM_COST_ESTIMATION', drCommentary: 'Please revise',
      });
    });

    it('transitions to REROUTED with spStep=DM_COST_ESTIMATION and stores drCommentary', async () => {
      await service.spReworkOffer(DEMAND_ID, ORIGINATOR_ID, { commentary: 'Please revise' });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DemandStatus.REROUTED,
            spStep: 'DM_COST_ESTIMATION',
            drCommentary: 'Please revise',
          }),
        }),
      );
    });

    it('emits SP_OFFER_REWORKED event after transaction', async () => {
      await service.spReworkOffer(DEMAND_ID, ORIGINATOR_ID, { commentary: 'Revise costs' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.spOfferReworked', expect.objectContaining({ demandId: DEMAND_ID }));
    });

    it('throws ForbiddenException for non-originator', async () => {
      await expect(service.spReworkOffer(DEMAND_ID, OTHER_USER_ID, { commentary: 'x' })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if demand is not at SP_OFFER_REVIEW', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...spOfferReviewDemand, status: DemandStatus.IN_REVIEW });
      await expect(service.spReworkOffer(DEMAND_ID, ORIGINATOR_ID, { commentary: 'x' })).rejects.toThrow(BadRequestException);
    });

    it('writes audit log with SP_OFFER_REWORKED event type last', async () => {
      await service.spReworkOffer(DEMAND_ID, ORIGINATOR_ID, { commentary: 'x' });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'SP_OFFER_REWORKED' }) }),
      );
      const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
      const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
      expect(auditCall).toBeGreaterThan(updateCall);
    });
  });

  // ── Story 4.12 — spAcceptAndEstimate() ─────────────────────────────────────

  describe('Story 4.12 — spAcceptAndEstimate()', () => {
    const spSubmittedForCombined = {
      ...spSubmittedDemand,
      status: DemandStatus.SUBMITTED,
      spStep: null,
    };
    const spReroutedAtCostEstimation = {
      ...spSubmittedDemand,
      status: DemandStatus.REROUTED,
      spStep: 'DM_COST_ESTIMATION',
    };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(spSubmittedForCombined);
      prisma.demand.update.mockResolvedValue({
        ...spSubmittedForCombined,
        status: DemandStatus.SP_OFFER_REVIEW,
        spStep: 'DR_OFFER_REVIEW',
        dmDecision: 'ACCEPT',
      });
      prisma.financialPlanEntry.findMany.mockImplementation(({ where }: { where: { category: string } }) => {
        if (where.category === 'opex') return Promise.resolve([{ category: 'opex', valueCents: 5000 }]);
        return Promise.resolve([]);
      });
    });

    it('transitions SUBMITTED → SP_OFFER_REVIEW with spStep=DR_OFFER_REVIEW, dmDecision=ACCEPT, clears drCommentary', async () => {
      await service.spAcceptAndEstimate(DEMAND_ID, DM_ID);
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DemandStatus.SP_OFFER_REVIEW,
            spStep: 'DR_OFFER_REVIEW',
            dmDecision: 'ACCEPT',
            drCommentary: null,
          }),
        }),
      );
    });

    it('transitions REROUTED+DM_COST_ESTIMATION → SP_OFFER_REVIEW (rework re-entry)', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(spReroutedAtCostEstimation);
      await service.spAcceptAndEstimate(DEMAND_ID, DM_ID);
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DemandStatus.SP_OFFER_REVIEW, spStep: 'DR_OFFER_REVIEW' }),
        }),
      );
    });

    it('writes audit log with SP_DM_ACCEPTED_AND_ESTIMATED event type last', async () => {
      await service.spAcceptAndEstimate(DEMAND_ID, DM_ID);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'SP_DM_ACCEPTED_AND_ESTIMATED' }) }),
      );
      const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
      const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
      expect(auditCall).toBeGreaterThan(updateCall);
    });

    it('emits SP_OFFER_SENT event after transaction', async () => {
      await service.spAcceptAndEstimate(DEMAND_ID, DM_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.spOfferSent', expect.objectContaining({ demandId: DEMAND_ID }));
    });

    it('throws UnprocessableEntityException when no OPEX entries have value (AC-8)', async () => {
      prisma.financialPlanEntry.findMany.mockResolvedValue([]);
      await expect(service.spAcceptAndEstimate(DEMAND_ID, DM_ID)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when all OPEX entries are zero (AC-8)', async () => {
      prisma.financialPlanEntry.findMany.mockImplementation(({ where }: { where: { category: string } }) => {
        if (where.category === 'opex') return Promise.resolve([{ category: 'opex', valueCents: 0 }]);
        return Promise.resolve([]);
      });
      await expect(service.spAcceptAndEstimate(DEMAND_ID, DM_ID)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws BadRequestException if demand is not an SP demand', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...spSubmittedForCombined, isSmallProject: false });
      await expect(service.spAcceptAndEstimate(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if demand is already at DR_OFFER_REVIEW', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({
        ...spSubmittedForCombined,
        status: DemandStatus.IN_REVIEW,
        spStep: 'DR_OFFER_REVIEW',
      });
      await expect(service.spAcceptAndEstimate(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when demand is outside DM scope', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.spAcceptAndEstimate(DEMAND_ID, DM_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.14 — convertToSmallProject()', () => {
    const pDemandSubmitted = {
      ...submittedDemand,
      isSmallProject: false,
      spStep: null,
      businessControllerId: 'bc-cuid-1',
      bcStatus: null,
    };
    const pDemandBcReview = {
      ...pDemandSubmitted,
      status: DemandStatus.BC_REVIEW,
      bcStatus: 'IN_REVIEW',
    };

    beforeEach(() => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(pDemandSubmitted);
      prisma.demand.update.mockResolvedValue({ ...pDemandSubmitted, isSmallProject: true, spStep: 'DR_OFFER_REVIEW', status: DemandStatus.SP_OFFER_REVIEW });
      prisma.financialPlanEntry.aggregate.mockResolvedValue({ _sum: { valueCents: 3_000_000 } }); // below 5M threshold
    });

    it('sets isSmallProject=true, spStep=DR_OFFER_REVIEW, status=SP_OFFER_REVIEW for a SUBMITTED P demand', async () => {
      await service.convertToSmallProject(DEMAND_ID, DM_ID);
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isSmallProject: true,
            spStep: 'DR_OFFER_REVIEW',
            status: DemandStatus.SP_OFFER_REVIEW,
          }),
        }),
      );
    });

    it('transitions BC_REVIEW → SP_OFFER_REVIEW and clears bcStatus when converting from BC_REVIEW', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue(pDemandBcReview);
      await service.convertToSmallProject(DEMAND_ID, DM_ID);
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isSmallProject: true,
            status: DemandStatus.SP_OFFER_REVIEW,
            spStep: 'DR_OFFER_REVIEW',
            bcStatus: null,
          }),
        }),
      );
    });

    it('writes audit log with DEMAND_TYPE_SWITCHED event type last', async () => {
      await service.convertToSmallProject(DEMAND_ID, DM_ID);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'DEMAND_TYPE_SWITCHED',
            before: expect.objectContaining({ type: 'P' }),
            after: expect.objectContaining({ type: 'SP', status: DemandStatus.SP_OFFER_REVIEW, spStep: 'DR_OFFER_REVIEW' }),
          }),
        }),
      );
      const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
      const updateCall = prisma.demand.update.mock.invocationCallOrder[0];
      expect(auditCall).toBeGreaterThan(updateCall);
    });

    it('emits DEMAND_TYPE_SWITCHED event after transaction', async () => {
      await service.convertToSmallProject(DEMAND_ID, DM_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith('demand.typeSwitched', expect.objectContaining({ demandId: DEMAND_ID }));
    });

    it('throws BadRequestException if demand is already an SP demand', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...pDemandSubmitted, isSmallProject: true });
      await expect(service.convertToSmallProject(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if status is not SUBMITTED or BC_REVIEW', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...pDemandSubmitted, status: DemandStatus.IN_REVIEW });
      await expect(service.convertToSmallProject(DEMAND_ID, DM_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when demand is outside DM scope', async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.convertToSmallProject(DEMAND_ID, DM_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Story 4.10 — deleteDraft()', () => {
    it('T6.1 — happy path: own DRAFT demand is deleted and audit log written', async () => {
      await service.deleteDraft(DEMAND_ID, ORIGINATOR_ID);

      expect(prisma.demand.delete).toHaveBeenCalledWith({ where: { id: DEMAND_ID } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'Demand',
            entityId: DEMAND_ID,
            eventType: 'DRAFT_DELETED',
            changedBy: ORIGINATOR_ID,
          }),
        }),
      );
    });

    it('T6.1b — audit log is written AFTER demand.delete (Rule 8)', async () => {
      await service.deleteDraft(DEMAND_ID, ORIGINATOR_ID);
      const auditCall = prisma.auditLog.create.mock.invocationCallOrder[0];
      const deleteCall = prisma.demand.delete.mock.invocationCallOrder[0];
      expect(auditCall).toBeGreaterThan(deleteCall);
    });

    it('T6.2 — throws ForbiddenException when requester is not the owner', async () => {
      await expect(service.deleteDraft(DEMAND_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
      expect(prisma.demand.delete).not.toHaveBeenCalled();
    });

    it('T6.3 — throws BadRequestException when demand status is not DRAFT', async () => {
      prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...baseDemand, status: DemandStatus.SUBMITTED });
      await expect(service.deleteDraft(DEMAND_ID, ORIGINATOR_ID)).rejects.toThrow(BadRequestException);
      expect(prisma.demand.delete).not.toHaveBeenCalled();
    });
  });
});

// ── getDashboardStats (Story 4.6) ─────────────────────────────────────────────

describe('DemandsService — getDashboardStats()', () => {
  let service: DemandsService;
  let prisma: {
    demand: { count: jest.Mock; findMany: jest.Mock };
    financialPlanEntry: { aggregate: jest.Mock };
  };

  const now = Date.now();
  const freshDate = new Date(now - 1 * 86_400_000);            // 1 day ago — not stalled
  const stalledDate = new Date(now - 10 * 86_400_000);         // 10 days ago — stalled (> 7)

  const activeDemand = (status: DemandStatus, statusChangedAt: Date, id = 'd-1') => ({
    ...baseDemand,
    id,
    status,
    statusChangedAt,
    updatedAt: new Date(0),
    submittedAt: null,
    costCentreId: COST_CENTRE_ID,
    pmCommentary: null,
    pmActionedBy: null,
    pmActionedAt: null,
  });

  beforeEach(async () => {
    prisma = {
      demand: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      financialPlanEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { valueCents: 0 } }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        DemandsService,
        DemandWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SystemConfigService, useValue: { getAll: jest.fn().mockResolvedValue(DEFAULT_SYSTEM_CONFIG) } },
        { provide: FlagService, useValue: { get: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    service = module.get(DemandsService);
  });

  it('returns correct totalActiveDemands count (statuses NOT IN DRAFT/COMPLETED/CANCELLED)', async () => {
    prisma.demand.count
      .mockResolvedValueOnce(5)   // totalActiveDemands
      .mockResolvedValueOnce(2);  // demandsPendingDecision
    const result = await service.getDashboardStats();
    expect(result.totalActiveDemands).toBe(5);
  });

  it('returns correct demandsPendingDecision count (SUBMITTED + IN_REVIEW)', async () => {
    prisma.demand.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);
    const result = await service.getDashboardStats();
    expect(result.demandsPendingDecision).toBe(3);
  });

  it('budgetCommittedCents sums valueCents for APPROVED/IN_EXECUTION only', async () => {
    prisma.financialPlanEntry.aggregate
      .mockResolvedValueOnce({ _sum: { valueCents: 400_00 } })  // committed
      .mockResolvedValueOnce({ _sum: { valueCents: 700_00 } }); // planned
    const result = await service.getDashboardStats();
    expect(result.budgetCommittedCents).toBe(400_00);
    expect(result.budgetPlannedCents).toBe(700_00);
  });

  it('budgetCommittedCents is 0 when no financial plans exist', async () => {
    prisma.financialPlanEntry.aggregate
      .mockResolvedValue({ _sum: { valueCents: null } });
    const result = await service.getDashboardStats();
    expect(result.budgetCommittedCents).toBe(0);
    expect(result.budgetPlannedCents).toBe(0);
  });

  it('stalledDemands includes demands where age > DM_STALL_THRESHOLD_DAYS (7)', async () => {
    prisma.demand.findMany.mockResolvedValue([
      activeDemand(DemandStatus.SUBMITTED, stalledDate, 'd-stalled'),
      activeDemand(DemandStatus.IN_REVIEW, freshDate, 'd-fresh'),
    ]);
    const result = await service.getDashboardStats();
    expect(result.stalledDemands).toHaveLength(1);
    expect(result.stalledDemands[0].id).toBe('d-stalled');
  });

  it('stalledDemands uses same threshold (DM_STALL_THRESHOLD_DAYS = 7) as getDmQueue', async () => {
    const exactlyThreshold = new Date(now - 7 * 86_400_000);
    const oneDayOver = new Date(now - 8 * 86_400_000);
    prisma.demand.findMany.mockResolvedValue([
      activeDemand(DemandStatus.SUBMITTED, exactlyThreshold, 'd-exact'),  // 7 days — NOT stalled
      activeDemand(DemandStatus.SUBMITTED, oneDayOver, 'd-over'),          // 8 days — stalled
    ]);
    const result = await service.getDashboardStats();
    expect(result.stalledDemands).toHaveLength(1);
    expect(result.stalledDemands[0].id).toBe('d-over');
  });

  it('returns empty stalledDemands when no active demands are stalled', async () => {
    prisma.demand.findMany.mockResolvedValue([
      activeDemand(DemandStatus.SUBMITTED, freshDate),
    ]);
    const result = await service.getDashboardStats();
    expect(result.stalledDemands).toHaveLength(0);
  });
});

// ── DemandsService — updateDemandDates (Story 2.13) ─────────────────────────

describe('DemandsService — updateDemandDates()', () => {
  const DM_USER_ID = 'dm-cuid-2';

  let service: DemandsService;
  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    demand: {
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    auditLog: { create: jest.Mock };
    userRoleAssignment: { findMany: jest.Mock; findFirst: jest.Mock };
    smallProjectArea: { findUnique: jest.Mock };
    project: { create: jest.Mock };
    user: { findMany: jest.Mock };
    financialPlanEntry: { aggregate: jest.Mock; findMany: jest.Mock };
    demandMilestone: { createMany: jest.Mock; deleteMany: jest.Mock };
  };

  const submittedDemandForDm = {
    ...baseDemand,
    status: DemandStatus.SUBMITTED,
    demandManagerId: DM_USER_ID,
    startDate: new Date('2026-01-01'),
    endDate:   new Date('2026-06-30'),
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: DEMAND_ID }]),
      demand: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(submittedDemandForDm),
        update: jest.fn().mockResolvedValue({ ...submittedDemandForDm, startDate: new Date('2026-03-01'), endDate: new Date('2026-09-30') }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      userRoleAssignment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      smallProjectArea: { findUnique: jest.fn().mockResolvedValue({ name: 'Test Area' }) },
      project: { create: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      financialPlanEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { valueCents: 0 } }), findMany: jest.fn().mockResolvedValue([]) },
      demandMilestone: { createMany: jest.fn().mockResolvedValue({ count: 0 }), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    const module = await Test.createTestingModule({
      providers: [
        DemandsService,
        DemandWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SystemConfigService, useValue: { getAll: jest.fn().mockResolvedValue(DEFAULT_SYSTEM_CONFIG) } },
        { provide: FlagService, useValue: { get: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    service = module.get(DemandsService);
  });

  it('updates dates and returns updated demand (AC-1)', async () => {
    const result = await service.updateDemandDates(
      DEMAND_ID,
      { startDate: '2026-03-01', endDate: '2026-09-30' },
      DM_USER_ID,
    );
    expect(prisma.demand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEMAND_ID },
        data: {
          startDate: new Date('2026-03-01'),
          endDate:   new Date('2026-09-30'),
        },
      }),
    );
    expect(result.startDate).toBe(new Date('2026-03-01').toISOString());
  });

  it('writes audit log as LAST operation in transaction (Rule 8)', async () => {
    const callOrder: string[] = [];
    prisma.demand.update.mockImplementation(async () => {
      callOrder.push('update');
      return { ...submittedDemandForDm, startDate: new Date('2026-03-01'), endDate: new Date('2026-09-30') };
    });
    prisma.auditLog.create.mockImplementation(async () => {
      callOrder.push('auditLog');
      return {};
    });

    await service.updateDemandDates(DEMAND_ID, { startDate: '2026-03-01', endDate: '2026-09-30' }, DM_USER_ID);

    expect(callOrder).toEqual(['update', 'auditLog']);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'DM_DATES_UPDATED',
          changedBy: DM_USER_ID,
        }),
      }),
    );
  });

  it('throws ForbiddenException when caller is not the assigned DM (AC-1)', async () => {
    await expect(
      service.updateDemandDates(DEMAND_ID, { startDate: '2026-03-01', endDate: '2026-09-30' }, 'other-dm'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when demand is in BC_REVIEW (AC-9)', async () => {
    prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...submittedDemandForDm, status: DemandStatus.BC_REVIEW });
    await expect(
      service.updateDemandDates(DEMAND_ID, { startDate: '2026-03-01', endDate: '2026-09-30' }, DM_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('BadRequestException message includes "SUBMITTED or REROUTED" (AC-9)', async () => {
    prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...submittedDemandForDm, status: DemandStatus.BC_REVIEW });
    await expect(
      service.updateDemandDates(DEMAND_ID, { startDate: '2026-03-01', endDate: '2026-09-30' }, DM_USER_ID),
    ).rejects.toThrow('SUBMITTED or REROUTED');
  });

  it('accepts REROUTED status (AC-9)', async () => {
    prisma.demand.findUniqueOrThrow.mockResolvedValue({ ...submittedDemandForDm, status: DemandStatus.REROUTED });
    await expect(
      service.updateDemandDates(DEMAND_ID, { startDate: '2026-03-01', endDate: '2026-09-30' }, DM_USER_ID),
    ).resolves.toBeDefined();
  });

  it('accepts both dates null (AC-11)', async () => {
    prisma.demand.update.mockResolvedValue({ ...submittedDemandForDm, startDate: null, endDate: null });
    await expect(
      service.updateDemandDates(DEMAND_ID, { startDate: null, endDate: null }, DM_USER_ID),
    ).resolves.toBeDefined();
    expect(prisma.demand.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { startDate: null, endDate: null } }),
    );
  });

  it('does NOT call withDemandLock — uses $transaction directly (Rule 4)', async () => {
    await service.updateDemandDates(DEMAND_ID, { startDate: '2026-03-01', endDate: '2026-09-30' }, DM_USER_ID);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
