import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StatusReportsService } from '../../src/status-reports/status-reports.service';
import { CreateStatusReportDto } from '@helix/shared';
import { Role } from '@helix/types';

const PROJECT_ID = 'proj-1';
const USER_ID    = 'user-1';
const OTHER_USER = 'user-2';

const greenDto: CreateStatusReportDto = {
  overallRag:        'GREEN',
  scheduleRag:       'GREEN',
  resourcesRag:      'GREEN',
  budgetCurrentRag:  'GREEN',
  budgetForecastRag: 'GREEN',
  stakeholdersRag:   'GREEN',
  valuePropRag:      'GREEN',
  providerRag:       'GREEN',
};

const makeReport = (overrides = {}) => ({
  id: 'sr-1',
  projectId: PROJECT_ID,
  submittedAt: new Date('2026-06-15T10:00:00Z'),
  submittedById: USER_ID,
  overallRag:        'GREEN',
  scheduleRag:       'GREEN',
  resourcesRag:      'GREEN',
  budgetCurrentRag:  'GREEN',
  budgetForecastRag: 'GREEN',
  stakeholdersRag:   'GREEN',
  valuePropRag:      'GREEN',
  providerRag:       'GREEN',
  overallExplanation:        null,
  scheduleExplanation:       null,
  resourcesExplanation:      null,
  budgetCurrentExplanation:  null,
  budgetForecastExplanation: null,
  stakeholdersExplanation:   null,
  valuePropExplanation:      null,
  providerExplanation:       null,
  keyAccomplishments: null,
  nextSteps:          null,
  goLiveDate:         null,
  ...overrides,
});

const makePrisma = () => ({
  project: {
    findUnique: jest.fn(),
  },
  statusReport: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
});

describe('StatusReportsService', () => {
  let service: StatusReportsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new StatusReportsService(prisma as never);
  });

  describe('create()', () => {
    it('throws ForbiddenException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.create(PROJECT_ID, USER_ID, greenDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller is not assignedPmId', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: OTHER_USER, status: 'IN_EXECUTION' });
      await expect(service.create(PROJECT_ID, USER_ID, greenDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when project is DRAFT', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'DRAFT' });
      await expect(service.create(PROJECT_ID, USER_ID, greenDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when project is PENDING_APPROVAL', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'PENDING_APPROVAL' });
      await expect(service.create(PROJECT_ID, USER_ID, greenDto)).rejects.toThrow(BadRequestException);
    });

    it('allows create when project is ASSUMED_COMPLETED', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'ASSUMED_COMPLETED' });
      prisma.statusReport.create.mockResolvedValue(makeReport());
      await expect(service.create(PROJECT_ID, USER_ID, greenDto)).resolves.toBeDefined();
    });

    it('sets submittedAt server-side (not from DTO)', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'IN_EXECUTION' });
      const report = makeReport();
      prisma.statusReport.create.mockResolvedValue(report);

      const before = new Date();
      await service.create(PROJECT_ID, USER_ID, greenDto);
      const after = new Date();

      const createCall = prisma.statusReport.create.mock.calls[0][0];
      const usedSubmittedAt: Date = createCall.data.submittedAt;
      expect(usedSubmittedAt).toBeInstanceOf(Date);
      expect(usedSubmittedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(usedSubmittedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('does not include submittedAt from DTO', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'IN_EXECUTION' });
      prisma.statusReport.create.mockResolvedValue(makeReport());

      await service.create(PROJECT_ID, USER_ID, greenDto);

      const createCall = prisma.statusReport.create.mock.calls[0][0];
      expect('submittedAt' in greenDto).toBe(false);
      expect(createCall.data.submittedAt).toBeInstanceOf(Date);
    });

    it('returns mapped response with ISO submittedAt', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'IN_EXECUTION' });
      prisma.statusReport.create.mockResolvedValue(makeReport());

      const result = await service.create(PROJECT_ID, USER_ID, greenDto);
      expect(result.submittedAt).toBe('2026-06-15T10:00:00.000Z');
      expect(result.overallRag).toBe('GREEN');
    });
  });

  describe('findByProject()', () => {
    it('throws ForbiddenException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.findByProject(PROJECT_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller is not assignedPmId', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: OTHER_USER, status: 'IN_EXECUTION' });
      await expect(service.findByProject(PROJECT_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when project is DRAFT', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'DRAFT' });
      await expect(service.findByProject(PROJECT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when project is PENDING_APPROVAL', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'PENDING_APPROVAL' });
      await expect(service.findByProject(PROJECT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('allows findByProject when project is ASSUMED_COMPLETED', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'ASSUMED_COMPLETED' });
      prisma.statusReport.findMany.mockResolvedValue([makeReport()]);
      await expect(service.findByProject(PROJECT_ID, USER_ID)).resolves.toHaveLength(1);
    });

    it('returns reports ordered desc by submittedAt', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'IN_EXECUTION' });
      prisma.statusReport.findMany.mockResolvedValue([makeReport()]);

      const result = await service.findByProject(PROJECT_ID, USER_ID);
      expect(prisma.statusReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submittedAt: 'desc' },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('allows PPM to read reports for a project they do not own', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: OTHER_USER, status: 'IN_EXECUTION' });
      prisma.statusReport.findMany.mockResolvedValue([makeReport()]);

      await expect(
        service.findByProject(PROJECT_ID, USER_ID, [Role.PortfolioManager]),
      ).resolves.toHaveLength(1);
    });

    it('allows PPM to read reports when project has no assigned PM', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: null, status: 'IN_EXECUTION' });
      prisma.statusReport.findMany.mockResolvedValue([]);

      await expect(
        service.findByProject(PROJECT_ID, USER_ID, [Role.PortfolioManager]),
      ).resolves.toHaveLength(0);
    });

    it('throws ForbiddenException for non-PPM user on another PM project', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: OTHER_USER, status: 'IN_EXECUTION' });
      await expect(
        service.findByProject(PROJECT_ID, USER_ID, [Role.ProjectManager]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin to read reports for a project they do not own', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: OTHER_USER, status: 'IN_EXECUTION' });
      prisma.statusReport.findMany.mockResolvedValue([makeReport()]);

      await expect(
        service.findByProject(PROJECT_ID, USER_ID, [Role.Admin]),
      ).resolves.toHaveLength(1);
    });

    it('allows PPM to read reports on a COMPLETED project (no status gate)', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: OTHER_USER, status: 'COMPLETED' });
      prisma.statusReport.findMany.mockResolvedValue([makeReport()]);

      await expect(
        service.findByProject(PROJECT_ID, USER_ID, [Role.PortfolioManager]),
      ).resolves.toHaveLength(1);
    });

    it('still blocks non-privileged user on non-active project status', async () => {
      prisma.project.findUnique.mockResolvedValue({ assignedPmId: USER_ID, status: 'COMPLETED' });
      await expect(
        service.findByProject(PROJECT_ID, USER_ID, [Role.ProjectManager]),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe('createStatusReportSchema Zod validation', () => {
  it('rejects non-green RAG without explanation', () => {
    const { createStatusReportSchema } = require('@helix/shared');
    const result = createStatusReportSchema.safeParse({
      ...greenDto,
      scheduleRag: 'AMBER',
      scheduleExplanation: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i: { path: unknown[] }) => i.path[0]);
      expect(paths).toContain('scheduleExplanation');
    }
  });

  it('accepts non-green RAG with a valid explanation', () => {
    const { createStatusReportSchema } = require('@helix/shared');
    const result = createStatusReportSchema.safeParse({
      ...greenDto,
      scheduleRag: 'RED',
      scheduleExplanation: 'Critical delay due to vendor',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all-green with no explanations', () => {
    const { createStatusReportSchema } = require('@helix/shared');
    const result = createStatusReportSchema.safeParse(greenDto);
    expect(result.success).toBe(true);
  });
});
