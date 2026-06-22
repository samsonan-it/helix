import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
// Story 6.1 / 6.6 — ProjectsService unit tests
import { ProjectsService } from '../../src/projects/projects.service';
import { Role } from '@helix/types';

const PROJECT_ID = 'proj-1';
const DEMAND_ID  = 'dem-1';
const USER_ID    = 'user-1';
const OTHER_USER = 'user-2';

const baseDemand = {
  id: DEMAND_ID,
  publicId: 42,
  title: 'Alpha Project',
  isSmallProject: false,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  description: 'Desc',
  asisDescription: null,
  tobeDescription: null,
  projectType: null,
  investmentApproval: null,
  demandScope: null,
  demandManagerId: null,
};

const baseProject = {
  id: PROJECT_ID,
  demandId: DEMAND_ID,
  status: 'IN_EXECUTION',
  currentStage: null,
  assignedPmId: USER_ID,
  createdAt: new Date('2026-06-01'),
  demand: baseDemand,
  assignedPm: { name: 'Alice PM' },
  statusReports: [],
  // Charter fields (all null by default)
  objective: null,
  necessity: null,
  gxpRelevant: null,
  eaInvolved: null,
  eaComment: null,
  itSecurityInvolved: null,
  itSecurityComment: null,
  scope: null,
  depsAssumptionsRisk: null,
  appPlatformOwner: null,
  businessPm: null,
  businessSponsor: null,
  icRecharge: null,
  icRechargeAlignmentConducted: null,
  archImpact: null,
  eaAlignmentConducted: null,
  itSecurityAlignmentConducted: null,
  maintenanceL1: null,
  maintenanceL2: null,
  maintenanceL3: null,
  licensesNeeded: null,
  licenseCostCents: null,
  licenseExpectedUsers: null,
  licenseMetric: null,
  licenseInBudget: null,
  qualitativeValue: null,
  quantitativeValue: null,
  valueCaseDescription: null,
  charterSubmittedAt: null,
  closureWorkDelivered: null,
  closureFinancialReconciled: null,
  closureHandoverDocumentPath: null,
  closurePmSummaryNotes: null,
  closureSubmittedAt: null,
};

const makePrisma = () => ({
  project: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  projectPlanItem: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => fn({
    project: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    projectPlanItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
  })),
});

const makeEventEmitter = () => ({
  emit: jest.fn(),
});

const makeFileStorage = () => ({
  upload: jest.fn().mockResolvedValue('handover-docs/proj-1-123.pdf'),
  delete: jest.fn().mockResolvedValue(undefined),
});

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'handoverDocument',
  originalname: 'handover.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  buffer: Buffer.from('pdf-content'),
  size: 100,
  destination: '',
  filename: '',
  path: '',
  stream: null as never,
  ...overrides,
});

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: ReturnType<typeof makePrisma>;
  let eventEmitter: ReturnType<typeof makeEventEmitter>;
  let fileStorage: ReturnType<typeof makeFileStorage>;

  beforeEach(() => {
    prisma = makePrisma();
    eventEmitter = makeEventEmitter();
    fileStorage = makeFileStorage();
    service = new ProjectsService(prisma as never, eventEmitter as never, fileStorage as never);
  });

  describe('getProjectList()', () => {
    it('scopes results to assignedPmId = userId for non-PPM users', async () => {
      prisma.project.findMany.mockResolvedValue([baseProject]);
      prisma.project.count.mockResolvedValue(1);
      await service.getProjectList(USER_ID, { page: 1, pageSize: 50, userRoles: ['ProjectManager'] });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedPmId: USER_ID }),
        }),
      );
    });

    it('does not scope by assignedPmId for PPM users', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);
      await service.getProjectList(USER_ID, { page: 1, pageSize: 50, userRoles: ['PortfolioManager'] });
      const call = prisma.project.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(call.where).not.toHaveProperty('assignedPmId');
    });

    it('excludes COMPLETED and CANCELLED by default', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);
      await service.getProjectList(USER_ID, { page: 1, pageSize: 50, userRoles: [] });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.objectContaining({ notIn: expect.arrayContaining(['COMPLETED', 'CANCELLED']) }),
          }),
        }),
      );
    });

    it('applies explicit status filter when provided', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);
      await service.getProjectList(USER_ID, { page: 1, pageSize: 50, status: 'COMPLETED', userRoles: [] });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('applies pagination correctly', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);
      await service.getProjectList(USER_ID, { page: 3, pageSize: 10, userRoles: [] });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('returns mapped ProjectItem with overallRag = null when no reports', async () => {
      prisma.project.findMany.mockResolvedValue([baseProject]);
      prisma.project.count.mockResolvedValue(1);
      const result = await service.getProjectList(USER_ID, { page: 1, pageSize: 50, userRoles: [] });
      expect(result.data[0]).toMatchObject({
        id: PROJECT_ID,
        title: 'Alpha Project',
        demandType: 'P',
        overallRag: null,
        status: 'IN_EXECUTION',
        assignedPmName: 'Alice PM',
      });
    });
  });

  describe('getProject()', () => {
    it('returns project detail when found and owned by user', async () => {
      prisma.project.findUnique.mockResolvedValue(baseProject);
      const result = await service.getProject(PROJECT_ID, USER_ID, []);
      expect(result.id).toBe(PROJECT_ID);
      expect(result.title).toBe('Alpha Project');
      expect(result.publicId).toBe(42);
    });

    it('returns charter fields in detail', async () => {
      const withCharter = { ...baseProject, scope: 'Rebuild billing', maintenanceL1: 'Team A' };
      prisma.project.findUnique.mockResolvedValue(withCharter);
      const result = await service.getProject(PROJECT_ID, USER_ID, []);
      expect(result.scope).toBe('Rebuild billing');
      expect(result.maintenanceL1).toBe('Team A');
    });

    it('throws NotFoundException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.getProject(PROJECT_ID, USER_ID, [])).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when assignedPmId does not match caller and no PPM role', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...baseProject, assignedPmId: OTHER_USER });
      await expect(service.getProject(PROJECT_ID, USER_ID, [])).rejects.toThrow(NotFoundException);
    });

    it('allows PPM to view any project', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...baseProject, assignedPmId: OTHER_USER });
      const result = await service.getProject(PROJECT_ID, USER_ID, [Role.PortfolioManager]);
      expect(result.id).toBe(PROJECT_ID);
    });
  });

  describe('updateCurrentStage()', () => {
    const baseStageProject = {
      assignedPmId: USER_ID,
      status: 'IN_EXECUTION',
      currentStage: null,
      demand: { isSmallProject: false, demandManagerId: null },
    };

    it('throws NotFoundException when project not found', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }));
      await expect(service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Initiation')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when caller is not the assigned PM', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue({ ...baseStageProject, assignedPmId: OTHER_USER }), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }));
      await expect(service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Initiation')).rejects.toThrow(NotFoundException);
    });

    it('allows DM to update stage on SP project', async () => {
      const spDmProject = {
        ...baseStageProject,
        assignedPmId: OTHER_USER,
        demand: { isSmallProject: true, demandManagerId: USER_ID },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue(spDmProject), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }));
      await expect(service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Initiation')).resolves.toBeUndefined();
    });

    it('allows PPM to update stage regardless of assignedPmId', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue({ ...baseStageProject, assignedPmId: OTHER_USER }), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }));
      await expect(service.updateCurrentStage(PROJECT_ID, USER_ID, [Role.PortfolioManager], 'Initiation')).resolves.toBeUndefined();
    });

    it('throws BadRequestException when project is not IN_EXECUTION', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue({ ...baseStageProject, status: 'DRAFT' }), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }));
      await expect(service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Initiation')).rejects.toThrow(BadRequestException);
    });

    it('calls $transaction for a normal stage update', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue(baseStageProject), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }));
      await service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Initiation');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('writes PROJECT_STAGE_UPDATED audit log for non-Closure stage', async () => {
      let capturedAuditCreate: jest.Mock | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          project: { findUnique: jest.fn().mockResolvedValue(baseStageProject), update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        capturedAuditCreate = txMock.auditLog.create;
        return fn(txMock);
      });
      await service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Testing');
      expect(capturedAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'PROJECT_STAGE_UPDATED' }) }),
      );
    });

    it('writes PROJECT_CLOSURE_INITIATED and transitions status for Closure stage', async () => {
      let capturedProjectUpdate: jest.Mock | undefined;
      let capturedAuditCreate: jest.Mock | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          project: { findUnique: jest.fn().mockResolvedValue(baseStageProject), update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        capturedProjectUpdate = txMock.project.update;
        capturedAuditCreate = txMock.auditLog.create;
        return fn(txMock);
      });
      await service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Closure');
      expect(capturedProjectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PREPARE_FOR_CLOSURE', currentStage: 'Closure' }) }),
      );
      expect(capturedAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'PROJECT_CLOSURE_INITIATED' }) }),
      );
    });
  });

  describe('updateCharter() — Story 6.6', () => {
    function mockUpdateCharterTx(projectOverride: { assignedPmId: string; status: string }) {
      let capturedTx: { project: { update: jest.Mock }; auditLog: { create: jest.Mock } } | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          project: { findUnique: jest.fn().mockResolvedValue(projectOverride), update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        capturedTx = tx;
        return fn(tx);
      });
      return () => capturedTx;
    }

    it('allows assigned PM to update charter in DRAFT', async () => {
      const getTx = mockUpdateCharterTx({ assignedPmId: USER_ID, status: 'DRAFT' });
      await expect(service.updateCharter(PROJECT_ID, USER_ID, [] as Role[], { scope: 'Some scope' })).resolves.toBeUndefined();
      expect(getTx()?.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ scope: 'Some scope' }) }),
      );
    });

    it('allows PPM to update charter regardless of ownership', async () => {
      mockUpdateCharterTx({ assignedPmId: OTHER_USER, status: 'DRAFT' });
      await expect(service.updateCharter(PROJECT_ID, USER_ID, [Role.PortfolioManager], { scope: 'PPM edit' })).resolves.toBeUndefined();
    });

    it('allows Admin to update charter', async () => {
      mockUpdateCharterTx({ assignedPmId: OTHER_USER, status: 'DRAFT' });
      await expect(service.updateCharter(PROJECT_ID, USER_ID, [Role.Admin], { scope: 'Admin edit' })).resolves.toBeUndefined();
    });

    it('throws ForbiddenException for a stranger (not PM, not PPM, not Admin)', async () => {
      mockUpdateCharterTx({ assignedPmId: OTHER_USER, status: 'DRAFT' });
      await expect(service.updateCharter(PROJECT_ID, USER_ID, [] as Role[], { scope: 'Stranger' })).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when assigned PM tries to edit in PENDING_APPROVAL', async () => {
      mockUpdateCharterTx({ assignedPmId: USER_ID, status: 'PENDING_APPROVAL' });
      await expect(service.updateCharter(PROJECT_ID, USER_ID, [] as Role[], { scope: 'Late edit' })).rejects.toThrow(ForbiddenException);
    });

    it('writes PROJECT_CHARTER_UPDATED audit log inside transaction', async () => {
      const getTx = mockUpdateCharterTx({ assignedPmId: USER_ID, status: 'DRAFT' });
      await service.updateCharter(PROJECT_ID, USER_ID, [] as Role[], { scope: 'Audit check' });
      expect(getTx()?.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'PROJECT_CHARTER_UPDATED' }) }),
      );
    });

    it('audit log is written after project update (Rule 8)', async () => {
      const getTx = mockUpdateCharterTx({ assignedPmId: USER_ID, status: 'DRAFT' });
      await service.updateCharter(PROJECT_ID, USER_ID, [] as Role[], { scope: 'Rule 8 check' });
      const tx = getTx()!;
      const updateOrder = tx.project.update.mock.invocationCallOrder[0];
      const auditOrder = tx.auditLog.create.mock.invocationCallOrder[0];
      expect(auditOrder).toBeGreaterThan(updateOrder);
    });
  });

  describe('submitCharter() — Story 6.6', () => {
    const fullCharterProject = {
      ...baseProject,
      status: 'DRAFT',
      objective: 'Rebuild billing capabilities',
      necessity: 'Current system cannot scale',
      scope: 'Rebuild billing module',
      depsAssumptionsRisk: 'None known',
      appPlatformOwner: 'Jane Doe',
      businessPm: 'Bob Smith',
      businessSponsor: 'CEO',
      icRecharge: true,
      icRechargeAlignmentConducted: true,
      archImpact: 'Medium impact on API layer',
      eaAlignmentConducted: true,
      itSecurityAlignmentConducted: true,
      maintenanceL1: 'L1 Team',
      maintenanceL2: 'L2 Team',
      maintenanceL3: 'L3 Team',
      licensesNeeded: false,
    };

    beforeEach(() => {
      prisma.project.findUnique.mockResolvedValue({ demand: { title: 'Alpha Project' } });
    });

    it('transitions project DRAFT → PENDING_APPROVAL', async () => {
      let capturedUpdate: jest.Mock | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(fullCharterProject),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
        };
        capturedUpdate = tx.project.update;
        return fn(tx);
      });
      await service.submitCharter(PROJECT_ID, USER_ID);
      expect(capturedUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_APPROVAL' }) }),
      );
    });

    it('throws ForbiddenException when caller is not the assigned PM', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ ...fullCharterProject, assignedPmId: OTHER_USER }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
        };
        return fn(tx);
      });
      await expect(service.submitCharter(PROJECT_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not DRAFT', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ ...fullCharterProject, status: 'PENDING_APPROVAL' }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
        };
        return fn(tx);
      });
      await expect(service.submitCharter(PROJECT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when mandatory charter fields are missing', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ ...fullCharterProject, scope: null }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
        };
        return fn(tx);
      });
      await expect(service.submitCharter(PROJECT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('writes PROJECT_CHARTER_SUBMITTED audit log as last action in transaction', async () => {
      let capturedUpdate: jest.Mock | undefined;
      let capturedAudit: jest.Mock | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(fullCharterProject),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
        };
        capturedUpdate = tx.project.update;
        capturedAudit = tx.auditLog.create;
        return fn(tx);
      });
      await service.submitCharter(PROJECT_ID, USER_ID);
      expect(capturedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'PROJECT_CHARTER_SUBMITTED',
            before: { status: 'DRAFT' },
            after: { status: 'PENDING_APPROVAL' },
          }),
        }),
      );
      // audit must be called AFTER project.update (Rule 8)
      const updateOrder = (capturedUpdate as jest.Mock).mock.invocationCallOrder[0];
      const auditOrder = (capturedAudit as jest.Mock).mock.invocationCallOrder[0];
      expect(auditOrder).toBeGreaterThan(updateOrder);
    });

    it('emits CHARTER_SUBMITTED event after transaction', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(fullCharterProject),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
        };
        return fn(tx);
      });
      await service.submitCharter(PROJECT_ID, USER_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.charter_submitted',
        expect.objectContaining({ projectId: PROJECT_ID, pmId: USER_ID }),
      );
    });
  });

  describe('uploadHandoverDocument()', () => {
    const closureProject = {
      assignedPmId: USER_ID,
      status: 'PREPARE_FOR_CLOSURE',
      closureSubmittedAt: null,
      closureHandoverDocumentPath: null,
      demand: { isSmallProject: false, demandManagerId: null },
    };

    it('throws NotFoundException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.uploadHandoverDocument(PROJECT_ID, USER_ID, [], makeFile())).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not PM, DM, or PPM/Admin', async () => {
      prisma.project.findUnique.mockResolvedValue(closureProject);
      await expect(service.uploadHandoverDocument(PROJECT_ID, OTHER_USER, [], makeFile())).rejects.toThrow(ForbiddenException);
    });

    it('allows PPM to upload', async () => {
      prisma.project.findUnique.mockResolvedValue(closureProject);
      prisma.project.update.mockResolvedValue({});
      await expect(service.uploadHandoverDocument(PROJECT_ID, OTHER_USER, [Role.PortfolioManager], makeFile())).resolves.toEqual({ fileName: 'handover.pdf' });
    });

    it('allows DM on SP project to upload', async () => {
      prisma.project.findUnique.mockResolvedValue({
        ...closureProject,
        demand: { isSmallProject: true, demandManagerId: OTHER_USER },
      });
      prisma.project.update.mockResolvedValue({});
      await expect(service.uploadHandoverDocument(PROJECT_ID, OTHER_USER, [], makeFile())).resolves.toEqual({ fileName: 'handover.pdf' });
    });

    it('throws BadRequestException when status is not PREPARE_FOR_CLOSURE', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...closureProject, status: 'IN_EXECUTION' });
      await expect(service.uploadHandoverDocument(PROJECT_ID, USER_ID, [], makeFile())).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when closure already submitted', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...closureProject, closureSubmittedAt: new Date() });
      await expect(service.uploadHandoverDocument(PROJECT_ID, USER_ID, [], makeFile())).rejects.toThrow(BadRequestException);
    });

    it('calls fileStorage.delete with old key before uploading new one', async () => {
      const oldKey = 'handover-docs/old-file.pdf';
      prisma.project.findUnique.mockResolvedValue({ ...closureProject, closureHandoverDocumentPath: oldKey });
      prisma.project.update.mockResolvedValue({});
      await service.uploadHandoverDocument(PROJECT_ID, USER_ID, [], makeFile());
      expect(fileStorage.delete).toHaveBeenCalledWith(oldKey);
    });

    it('does not call fileStorage.delete when no previous document', async () => {
      prisma.project.findUnique.mockResolvedValue(closureProject);
      prisma.project.update.mockResolvedValue({});
      await service.uploadHandoverDocument(PROJECT_ID, USER_ID, [], makeFile());
      expect(fileStorage.delete).not.toHaveBeenCalled();
    });
  });

  describe('acceptClosure()', () => {
    function setupAcceptTx(projectOverrides = {}) {
      const projectInTx = {
        status: 'PREPARE_FOR_CLOSURE',
        assignedPmId: USER_ID,
        demand: { title: 'Alpha Project' },
        ...projectOverrides,
      };
      let capturedTx: { project: { update: jest.Mock }; auditLog: { create: jest.Mock } } | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(projectInTx),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        capturedTx = tx;
        return fn(tx);
      });
      return () => capturedTx;
    }

    it('throws ForbiddenException for PM role only', async () => {
      await expect(service.acceptClosure(PROJECT_ID, USER_ID, [Role.ProjectManager])).rejects.toThrow(ForbiddenException);
    });

    it('allows PortfolioManager role', async () => {
      setupAcceptTx();
      await expect(service.acceptClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager])).resolves.toBeUndefined();
    });

    it('allows Admin role', async () => {
      setupAcceptTx();
      await expect(service.acceptClosure(PROJECT_ID, USER_ID, [Role.Admin])).resolves.toBeUndefined();
    });

    it('throws BadRequestException when status is IN_EXECUTION', async () => {
      setupAcceptTx({ status: 'IN_EXECUTION' });
      await expect(service.acceptClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager])).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when status is COMPLETED', async () => {
      setupAcceptTx({ status: 'COMPLETED' });
      await expect(service.acceptClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager])).rejects.toThrow(BadRequestException);
    });

    it('transitions project to COMPLETED', async () => {
      const getTx = setupAcceptTx();
      await service.acceptClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager]);
      expect(getTx()?.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
    });

    it('writes CLOSURE_ACCEPTED audit log as last action in transaction (Rule 8)', async () => {
      const getTx = setupAcceptTx();
      await service.acceptClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager]);
      const tx = getTx()!;
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'CLOSURE_ACCEPTED' }) }),
      );
      const updateOrder = tx.project.update.mock.invocationCallOrder[0];
      const auditOrder = tx.auditLog.create.mock.invocationCallOrder[0];
      expect(auditOrder).toBeGreaterThan(updateOrder);
    });

    it('emits CLOSURE_ACCEPTED event after transaction', async () => {
      setupAcceptTx();
      await service.acceptClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager]);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.closure_accepted',
        expect.objectContaining({ projectId: PROJECT_ID, ppmId: USER_ID }),
      );
    });
  });

  describe('returnClosure()', () => {
    function setupReturnTx(projectOverrides = {}) {
      const projectInTx = {
        status: 'PREPARE_FOR_CLOSURE',
        assignedPmId: USER_ID,
        demand: { title: 'Alpha Project' },
        ...projectOverrides,
      };
      let capturedTx: { project: { update: jest.Mock }; auditLog: { create: jest.Mock } } | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(projectInTx),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        capturedTx = tx;
        return fn(tx);
      });
      return () => capturedTx;
    }

    it('throws ForbiddenException for PM role only', async () => {
      await expect(service.returnClosure(PROJECT_ID, USER_ID, [Role.ProjectManager], 'reason')).rejects.toThrow(ForbiddenException);
    });

    it('allows PortfolioManager role', async () => {
      setupReturnTx();
      await expect(service.returnClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager], 'Needs rework')).resolves.toBeUndefined();
    });

    it('allows Admin role', async () => {
      setupReturnTx();
      await expect(service.returnClosure(PROJECT_ID, USER_ID, [Role.Admin], 'Needs rework')).resolves.toBeUndefined();
    });

    it('throws BadRequestException for empty comment', async () => {
      await expect(service.returnClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager], '')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for whitespace-only comment', async () => {
      await expect(service.returnClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager], '   ')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when status is COMPLETED', async () => {
      setupReturnTx({ status: 'COMPLETED' });
      await expect(service.returnClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager], 'reason')).rejects.toThrow(BadRequestException);
    });

    it('transitions project to IN_EXECUTION and resets closureSubmittedAt', async () => {
      const getTx = setupReturnTx();
      await service.returnClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager], 'Needs rework');
      expect(getTx()?.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'IN_EXECUTION', closureSubmittedAt: null } }),
      );
    });

    it('writes CLOSURE_RETURNED audit log last; after payload includes returnComment (Rule 8)', async () => {
      const getTx = setupReturnTx();
      await service.returnClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager], 'Needs rework');
      const tx = getTx()!;
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'CLOSURE_RETURNED',
            after: expect.objectContaining({ returnComment: 'Needs rework' }),
          }),
        }),
      );
      const updateOrder = tx.project.update.mock.invocationCallOrder[0];
      const auditOrder = tx.auditLog.create.mock.invocationCallOrder[0];
      expect(auditOrder).toBeGreaterThan(updateOrder);
    });

    it('emits CLOSURE_RETURNED event after transaction', async () => {
      setupReturnTx();
      await service.returnClosure(PROJECT_ID, USER_ID, [Role.PortfolioManager], 'Needs rework');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.closure_returned',
        expect.objectContaining({ projectId: PROJECT_ID, ppmId: USER_ID, comment: 'Needs rework' }),
      );
    });
  });

  describe('getClosureQueue()', () => {
    it('throws ForbiddenException for PM role only', async () => {
      await expect(service.getClosureQueue(USER_ID, [Role.ProjectManager])).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin role', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      await expect(service.getClosureQueue(USER_ID, [Role.Admin])).resolves.toEqual([]);
    });

    it('returns PREPARE_FOR_CLOSURE projects ordered by closureSubmittedAt for PPM', async () => {
      const closureProject = {
        ...baseProject,
        status: 'PREPARE_FOR_CLOSURE',
        closureSubmittedAt: new Date('2026-06-01'),
      };
      prisma.project.findMany.mockResolvedValue([closureProject]);
      const result = await service.getClosureQueue(USER_ID, [Role.PortfolioManager]);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PREPARE_FOR_CLOSURE' },
          orderBy: { closureSubmittedAt: 'asc' },
        }),
      );
      expect(result[0].status).toBe('PREPARE_FOR_CLOSURE');
    });
  });

  describe('approveCharter() — Story 6.7', () => {
    function setupApproveTx(projectOverrides = {}) {
      const projectInTx = {
        status: 'PENDING_APPROVAL',
        assignedPmId: OTHER_USER,
        demand: { title: 'Alpha Project' },
        ...projectOverrides,
      };
      let capturedTx: { project: { update: jest.Mock }; auditLog: { create: jest.Mock } } | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(projectInTx),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        capturedTx = tx;
        return fn(tx);
      });
      return () => capturedTx;
    }

    it('throws ForbiddenException for PM role only', async () => {
      await expect(service.approveCharter(PROJECT_ID, USER_ID, ['ProjectManager'])).rejects.toThrow(ForbiddenException);
    });

    it('allows PortfolioManager role', async () => {
      setupApproveTx();
      await expect(service.approveCharter(PROJECT_ID, USER_ID, ['PortfolioManager'])).resolves.toBeUndefined();
    });

    it('allows Admin role', async () => {
      setupApproveTx();
      await expect(service.approveCharter(PROJECT_ID, USER_ID, ['Admin'])).resolves.toBeUndefined();
    });

    it('throws BadRequestException when status is DRAFT (not PENDING_APPROVAL)', async () => {
      setupApproveTx({ status: 'DRAFT' });
      await expect(service.approveCharter(PROJECT_ID, USER_ID, ['PortfolioManager'])).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when PPM tries to approve their own charter (AC-5)', async () => {
      setupApproveTx({ assignedPmId: USER_ID });
      await expect(service.approveCharter(PROJECT_ID, USER_ID, ['PortfolioManager'])).rejects.toThrow(ForbiddenException);
    });

    it('transitions project to IN_EXECUTION with currentStage = Initiation', async () => {
      const getTx = setupApproveTx();
      await service.approveCharter(PROJECT_ID, USER_ID, ['PortfolioManager']);
      expect(getTx()?.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'IN_EXECUTION', currentStage: 'Initiation' } }),
      );
    });

    it('writes CHARTER_APPROVED audit log as last action in transaction (Rule 8)', async () => {
      const getTx = setupApproveTx();
      await service.approveCharter(PROJECT_ID, USER_ID, ['PortfolioManager']);
      const tx = getTx()!;
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'CHARTER_APPROVED',
            before: { status: 'PENDING_APPROVAL' },
            after: { status: 'IN_EXECUTION', currentStage: 'Initiation' },
          }),
        }),
      );
      const updateOrder = tx.project.update.mock.invocationCallOrder[0];
      const auditOrder = tx.auditLog.create.mock.invocationCallOrder[0];
      expect(auditOrder).toBeGreaterThan(updateOrder);
    });

    it('emits CHARTER_APPROVED event after transaction', async () => {
      setupApproveTx();
      await service.approveCharter(PROJECT_ID, USER_ID, ['PortfolioManager']);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.charter_approved',
        expect.objectContaining({ projectId: PROJECT_ID, ppmId: USER_ID }),
      );
    });
  });

  describe('returnCharter() — Story 6.7', () => {
    function setupReturnCharterTx(projectOverrides = {}) {
      const projectInTx = {
        status: 'PENDING_APPROVAL',
        assignedPmId: OTHER_USER,
        demand: { title: 'Alpha Project' },
        ...projectOverrides,
      };
      let capturedTx: { project: { update: jest.Mock }; auditLog: { create: jest.Mock } } | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(projectInTx),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        capturedTx = tx;
        return fn(tx);
      });
      return () => capturedTx;
    }

    it('throws ForbiddenException for PM role only', async () => {
      await expect(service.returnCharter(PROJECT_ID, USER_ID, ['ProjectManager'], 'reason')).rejects.toThrow(ForbiddenException);
    });

    it('allows PortfolioManager role', async () => {
      setupReturnCharterTx();
      await expect(service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], 'Needs rework')).resolves.toBeUndefined();
    });

    it('allows Admin role', async () => {
      setupReturnCharterTx();
      await expect(service.returnCharter(PROJECT_ID, USER_ID, ['Admin'], 'Needs rework')).resolves.toBeUndefined();
    });

    it('throws BadRequestException for empty comment', async () => {
      await expect(service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], '')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for whitespace-only comment', async () => {
      await expect(service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], '   ')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when status is DRAFT (not PENDING_APPROVAL)', async () => {
      setupReturnCharterTx({ status: 'DRAFT' });
      await expect(service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], 'reason')).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when PPM tries to return their own charter (AC-5)', async () => {
      setupReturnCharterTx({ assignedPmId: USER_ID });
      await expect(service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], 'reason')).rejects.toThrow(ForbiddenException);
    });

    it('transitions project to DRAFT', async () => {
      const getTx = setupReturnCharterTx();
      await service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], 'Needs rework');
      expect(getTx()?.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DRAFT' } }),
      );
    });

    it('writes CHARTER_RETURNED audit log last with returnComment in after payload (Rule 8)', async () => {
      const getTx = setupReturnCharterTx();
      await service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], 'Needs rework');
      const tx = getTx()!;
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'CHARTER_RETURNED',
            after: expect.objectContaining({ returnComment: 'Needs rework' }),
          }),
        }),
      );
      const updateOrder = tx.project.update.mock.invocationCallOrder[0];
      const auditOrder = tx.auditLog.create.mock.invocationCallOrder[0];
      expect(auditOrder).toBeGreaterThan(updateOrder);
    });

    it('emits CHARTER_RETURNED event after transaction', async () => {
      setupReturnCharterTx();
      await service.returnCharter(PROJECT_ID, USER_ID, ['PortfolioManager'], 'Needs rework');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.charter_returned',
        expect.objectContaining({ projectId: PROJECT_ID, ppmId: USER_ID, comment: 'Needs rework' }),
      );
    });
  });

  describe('getCharterQueue() — Story 6.7', () => {
    it('throws ForbiddenException for PM role only', async () => {
      await expect(service.getCharterQueue(USER_ID, ['ProjectManager'])).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin role', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      await expect(service.getCharterQueue(USER_ID, ['Admin'])).resolves.toEqual([]);
    });

    it('returns PENDING_APPROVAL projects ordered by charterSubmittedAt for PPM', async () => {
      const charterProject = {
        ...baseProject,
        status: 'PENDING_APPROVAL',
        charterSubmittedAt: new Date('2026-06-17'),
      };
      prisma.project.findMany.mockResolvedValue([charterProject]);
      const result = await service.getCharterQueue(USER_ID, ['PortfolioManager']);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING_APPROVAL' },
          orderBy: { charterSubmittedAt: 'asc' },
        }),
      );
      expect(result[0].status).toBe('PENDING_APPROVAL');
      expect(result[0].charterSubmittedAt).toBe('2026-06-17T00:00:00.000Z');
    });
  });

  describe('getProject() — PPM/Admin access (AC-6)', () => {
    it('allows PPM to view any project regardless of assignedPmId', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...baseProject, assignedPmId: OTHER_USER });
      const result = await service.getProject(PROJECT_ID, USER_ID, [Role.PortfolioManager]);
      expect(result.id).toBe(PROJECT_ID);
    });

    it('allows Admin to view any project regardless of assignedPmId', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...baseProject, assignedPmId: OTHER_USER });
      const result = await service.getProject(PROJECT_ID, USER_ID, [Role.Admin]);
      expect(result.id).toBe(PROJECT_ID);
    });

    it('throws NotFoundException when non-owner non-PPM non-Admin accesses project', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...baseProject, assignedPmId: OTHER_USER });
      await expect(service.getProject(PROJECT_ID, USER_ID, [])).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCurrentStage() — COMPLETED guard (AC-4)', () => {
    it('throws BadRequestException when status is COMPLETED', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: {
          findUnique: jest.fn().mockResolvedValue({
            assignedPmId: USER_ID, status: 'COMPLETED', currentStage: 'Closure',
            demand: { isSmallProject: false, demandManagerId: null },
          }),
          update: jest.fn(),
        },
        auditLog: { create: jest.fn() },
      }));
      await expect(service.updateCurrentStage(PROJECT_ID, USER_ID, [], 'Initiation')).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitClosure()', () => {
    const validDto = { workDelivered: true as const, financialReconciled: true as const };

    function setupSubmitTx(projectOverrides = {}) {
      const projectInTx = {
        assignedPmId: USER_ID,
        status: 'PREPARE_FOR_CLOSURE',
        closureSubmittedAt: null,
        closureHandoverDocumentPath: 'handover-docs/proj-1.pdf',
        demand: { isSmallProject: false, demandManagerId: null },
        ...projectOverrides,
      };
      let capturedTx: { project: { update: jest.Mock }; auditLog: { create: jest.Mock } } | undefined;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: PROJECT_ID }]),
          project: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(projectInTx),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        capturedTx = tx;
        return fn(tx);
      });
      return () => capturedTx;
    }

    it('throws ForbiddenException when caller has no access', async () => {
      setupSubmitTx();
      await expect(service.submitClosure(PROJECT_ID, OTHER_USER, [], validDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not PREPARE_FOR_CLOSURE', async () => {
      setupSubmitTx({ status: 'IN_EXECUTION' });
      await expect(service.submitClosure(PROJECT_ID, USER_ID, [], validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when already submitted', async () => {
      setupSubmitTx({ closureSubmittedAt: new Date() });
      await expect(service.submitClosure(PROJECT_ID, USER_ID, [], validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no handover document uploaded', async () => {
      setupSubmitTx({ closureHandoverDocumentPath: null });
      await expect(service.submitClosure(PROJECT_ID, USER_ID, [], validDto)).rejects.toThrow(BadRequestException);
    });

    it('writes project update then audit log (Rule 8)', async () => {
      const getTx = setupSubmitTx();
      await service.submitClosure(PROJECT_ID, USER_ID, [], validDto);
      const tx = getTx()!;
      const updateOrder = tx.project.update.mock.invocationCallOrder[0];
      const auditOrder = tx.auditLog.create.mock.invocationCallOrder[0];
      expect(auditOrder).toBeGreaterThan(updateOrder);
    });

    it('writes PROJECT_CLOSURE_SUBMITTED audit entry', async () => {
      const getTx = setupSubmitTx();
      await service.submitClosure(PROJECT_ID, USER_ID, [], validDto);
      expect(getTx()?.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'PROJECT_CLOSURE_SUBMITTED' }),
        }),
      );
    });

    it('emits CLOSURE_SUBMITTED event after transaction', async () => {
      setupSubmitTx();
      await service.submitClosure(PROJECT_ID, USER_ID, [], validDto);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.closure_submitted',
        expect.objectContaining({ projectId: PROJECT_ID, actorId: USER_ID }),
      );
    });
  });

  describe('getProjectPlan()', () => {
    const planItems = [
      { id: 'item-1', projectId: PROJECT_ID, name: 'Phase 1', type: 'PHASE', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), displayOrder: 0 },
      { id: 'item-2', projectId: PROJECT_ID, name: 'Go-Live', type: 'MILESTONE', startDate: new Date('2026-04-01'), endDate: null, displayOrder: 1 },
    ];

    it('returns items ordered by displayOrder', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID });
      prisma.projectPlanItem.findMany.mockResolvedValue(planItems);

      const result = await service.getProjectPlan(PROJECT_ID, USER_ID, []);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Phase 1');
      expect(result.items[0].startDate).toBe(new Date('2026-01-01').toISOString());
      expect(result.items[0].endDate).toBe(new Date('2026-03-31').toISOString());
      expect(result.items[1].endDate).toBeNull();
      expect(prisma.projectPlanItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { displayOrder: 'asc' } }),
      );
    });

    it('throws 403 for non-PM/PPM user', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: 'other-pm' });

      await expect(service.getProjectPlan(PROJECT_ID, USER_ID, [])).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectPlan(PROJECT_ID, USER_ID, [])).rejects.toThrow(NotFoundException);
    });

    it('allows PPM to access plan for any project', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: 'other-pm' });
      prisma.projectPlanItem.findMany.mockResolvedValue([]);

      const result = await service.getProjectPlan(PROJECT_ID, USER_ID, [Role.PortfolioManager]);
      expect(result.items).toHaveLength(0);
    });

    it('returns { items: [] } when assigned PM has no plan items yet (AC-2)', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID });
      prisma.projectPlanItem.findMany.mockResolvedValue([]);

      const result = await service.getProjectPlan(PROJECT_ID, USER_ID, []);
      expect(result).toEqual({ items: [] });
    });
  });

  describe('replaceProjectPlan()', () => {
    const validDto = {
      items: [
        { name: 'Phase 1', type: 'PHASE' as const, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-03-31T00:00:00.000Z' },
        { name: 'Go-Live', type: 'MILESTONE' as const, startDate: '2026-04-01T00:00:00.000Z' },
      ],
    };

    function setupReplaceTx(overrides: { assignedPmId?: string; status?: string } = {}) {
      const proj = { assignedPmId: overrides.assignedPmId ?? USER_ID, status: overrides.status ?? 'IN_EXECUTION' };
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue(proj) },
        projectPlanItem: { deleteMany: jest.fn(), createMany: jest.fn() },
        auditLog: { create: jest.fn() },
      }));
    }

    it('deletes old items and creates new ones in transaction', async () => {
      setupReplaceTx();
      await service.replaceProjectPlan(PROJECT_ID, USER_ID, [], validDto);

      const [[txFn]] = (prisma.$transaction as jest.Mock).mock.calls;
      const txArg = { project: { findUnique: jest.fn().mockResolvedValue({ assignedPmId: USER_ID, status: 'IN_EXECUTION' }) }, projectPlanItem: { deleteMany: jest.fn(), createMany: jest.fn() }, auditLog: { create: jest.fn() } };
      await txFn(txArg);

      expect(txArg.projectPlanItem.deleteMany).toHaveBeenCalledWith({ where: { projectId: PROJECT_ID } });
      expect(txArg.projectPlanItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ name: 'Phase 1', displayOrder: 0 })]) }),
      );
    });

    it('writes audit log as last action', async () => {
      const deleteMany = jest.fn();
      const createMany = jest.fn();
      const auditCreate = jest.fn();
      const callOrder: string[] = [];

      deleteMany.mockImplementation(() => { callOrder.push('deleteMany'); return Promise.resolve(); });
      createMany.mockImplementation(() => { callOrder.push('createMany'); return Promise.resolve(); });
      auditCreate.mockImplementation(() => { callOrder.push('audit'); return Promise.resolve(); });

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        project: { findUnique: jest.fn().mockResolvedValue({ assignedPmId: USER_ID, status: 'IN_EXECUTION' }) },
        projectPlanItem: { deleteMany, createMany },
        auditLog: { create: auditCreate },
      }));

      await service.replaceProjectPlan(PROJECT_ID, USER_ID, [], validDto);
      expect(callOrder[callOrder.length - 1]).toBe('audit');
    });

    it('rejects COMPLETED projects', async () => {
      setupReplaceTx({ status: 'COMPLETED' });
      await expect(service.replaceProjectPlan(PROJECT_ID, USER_ID, [], validDto)).rejects.toThrow(BadRequestException);
    });

    it('rejects CANCELLED projects', async () => {
      setupReplaceTx({ status: 'CANCELLED' });
      await expect(service.replaceProjectPlan(PROJECT_ID, USER_ID, [], validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws 403 for non-PM/PPM user', async () => {
      setupReplaceTx({ assignedPmId: 'other-pm' });
      await expect(service.replaceProjectPlan(PROJECT_ID, USER_ID, [], validDto)).rejects.toThrow(ForbiddenException);
    });

    it('allows PPM to replace plan', async () => {
      setupReplaceTx({ assignedPmId: 'other-pm' });
      await expect(service.replaceProjectPlan(PROJECT_ID, USER_ID, [Role.PortfolioManager], validDto)).resolves.toBeUndefined();
    });
  });

  describe('getProjectHistory', () => {
    const ACTOR_ID = 'actor-1';
    const baseEntry = {
      id: 'entry-1',
      eventType: 'PROJECT_CREATED',
      changedBy: ACTOR_ID,
      changedAt: new Date('2026-06-01T10:00:00Z'),
      before: null,
      after: null,
    };

    function setup(projectOverrides: Record<string, unknown> | null, entries = [baseEntry]) {
      const prisma = makePrisma() as ReturnType<typeof makePrisma> & { user: { findMany: jest.Mock }; auditLog: { create: jest.Mock; findMany: jest.Mock } };
      prisma.project.findUnique.mockResolvedValue(
        projectOverrides === null ? null : { assignedPmId: USER_ID, demand: { isSmallProject: false, demandManagerId: null }, ...projectOverrides },
      );
      prisma.auditLog.findMany = jest.fn().mockResolvedValue(entries);
      prisma.user = { findMany: jest.fn().mockResolvedValue([{ id: ACTOR_ID, name: 'Alice PM' }]) };
      const service = new ProjectsService(prisma as never, makeEventEmitter() as never, makeFileStorage() as never);
      return service;
    }

    it('throws 404 for unknown project', async () => {
      const service = setup(null);
      await expect(service.getProjectHistory(PROJECT_ID, USER_ID, [])).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when requester is not PM/PPM/Admin/SP-DM', async () => {
      const service = setup({ assignedPmId: OTHER_USER });
      await expect(service.getProjectHistory(PROJECT_ID, USER_ID, [])).rejects.toThrow(NotFoundException);
    });

    it('returns actor-resolved entries for assigned PM', async () => {
      const service = setup({});
      const result = await service.getProjectHistory(PROJECT_ID, USER_ID, []);
      expect(result).toHaveLength(1);
      expect(result[0].actorName).toBe('Alice PM');
      expect(result[0].changedAt).toBe('2026-06-01T10:00:00.000Z');
    });

    it('returns entries for PPM', async () => {
      const service = setup({ assignedPmId: OTHER_USER });
      const result = await service.getProjectHistory(PROJECT_ID, USER_ID, [Role.PortfolioManager]);
      expect(result).toHaveLength(1);
    });

    it('returns entries for Admin', async () => {
      const service = setup({ assignedPmId: OTHER_USER });
      const result = await service.getProjectHistory(PROJECT_ID, USER_ID, [Role.Admin]);
      expect(result).toHaveLength(1);
    });

    it('returns entries for SP DM', async () => {
      const service = setup({ assignedPmId: OTHER_USER, demand: { isSmallProject: true, demandManagerId: USER_ID } });
      const result = await service.getProjectHistory(PROJECT_ID, USER_ID, []);
      expect(result).toHaveLength(1);
    });
  });
});
