import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { AdminAuditController } from '../../src/admin/admin-audit.controller';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@helix/types';

const mockAuditRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'row-1',
  entityType: 'Demand',
  entityId: 'demand-cuid-1',
  eventType: 'update',
  changedBy: 'user-1',
  changedAt: new Date('2026-06-10T10:00:00Z'),
  before: { status: 'DRAFT' },
  after: { status: 'SUBMITTED' },
  ...overrides,
});

const mockActiveUser = {
  id: 'user-1',
  name: 'Alice Admin',
  status: 'active',
  azureAdOid: 'aad-oid-1',
};

const mockDepartedUser = {
  id: 'user-dep-1',
  name: 'Bob Departed',
  status: 'retention_only',
  azureAdOid: 'aad-oid-dep',
};

describe('AdminAuditController', () => {
  let controller: AdminAuditController;
  let prisma: {
    auditLog: { findMany: jest.Mock; count: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([mockAuditRow()]),
        count: jest.fn().mockResolvedValue(1),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([mockActiveUser]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminAuditController>(AdminAuditController);
  });

  describe('GET /admin/audit-logs (no filters)', () => {
    it('calls findMany with default sort, skip=0, take=50 and returns paginated result', async () => {
      const result = await controller.listAuditLogs({ page: 1, pageSize: 50 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { changedAt: 'desc' },
          skip: 0,
          take: 50,
        }),
      );
      expect(prisma.auditLog.count).toHaveBeenCalledTimes(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].changedAt).toBe('2026-06-10T10:00:00.000Z');
    });

    it('calls findMany and count in parallel (both invoked once per request)', async () => {
      await controller.listAuditLogs({ page: 1, pageSize: 50 });
      expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /admin/audit-logs with entityId + entityType filters', () => {
    it('passes entityId and entityType to where clause', async () => {
      await controller.listAuditLogs({ entityId: 'demand-1', entityType: 'Demand', page: 1, pageSize: 50 });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityId: 'demand-1', entityType: 'Demand' }),
        }),
      );
    });
  });

  describe('GET /admin/audit-logs with date range', () => {
    it('sets changedAt.gte and changedAt.lte from ISO strings', async () => {
      const from = '2026-01-01T00:00:00Z';
      const to   = '2026-12-31T23:59:59Z';
      await controller.listAuditLogs({ from, to, page: 1, pageSize: 50 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            changedAt: {
              gte: new Date(from),
              lte: new Date(to),
            },
          }),
        }),
      );
    });
  });

  describe('Actor resolution', () => {
    it('resolves actorName from active user', async () => {
      const result = await controller.listAuditLogs({ page: 1, pageSize: 50 });
      expect(result.data[0].actorName).toBe('Alice Admin');
      expect(result.data[0].actorId).toBe('user-1');
    });

    it('returns [Departed User — ID: {azureAdOid}] for retention_only user', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        mockAuditRow({ changedBy: 'user-dep-1' }),
      ]);
      prisma.user.findMany.mockResolvedValue([mockDepartedUser]);

      const result = await controller.listAuditLogs({ page: 1, pageSize: 50 });
      expect(result.data[0].actorName).toBe('[Departed User — ID: aad-oid-dep]');
    });

    it('returns changedBy raw value when user is not found (e.g. system)', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        mockAuditRow({ changedBy: 'system' }),
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await controller.listAuditLogs({ page: 1, pageSize: 50 });
      expect(result.data[0].actorName).toBe('system');
    });
  });

  describe('Pagination', () => {
    it('computes skip from page and pageSize', async () => {
      await controller.listAuditLogs({ page: 2, pageSize: 10 });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('returns correct page and pageSize in response', async () => {
      prisma.auditLog.count.mockResolvedValue(25);
      const result = await controller.listAuditLogs({ page: 2, pageSize: 10 });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(25);
    });
  });

  describe('Access control', () => {
    it('requires Admin role (metadata check)', () => {
      const metadata = Reflect.getMetadata('roles', AdminAuditController);
      expect(metadata).toContain(Role.Admin);
    });
  });
});
