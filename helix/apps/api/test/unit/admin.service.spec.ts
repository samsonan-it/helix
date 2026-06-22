import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminService } from '../../src/admin/admin.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const ADMIN_ID = 'admin-cuid-1';
const USER_ID = 'user-cuid-1';
const CC_ID = 'cc-cuid-1';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    $transaction: jest.Mock;
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    userRoleAssignment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    costCentre: {
      findMany: jest.Mock;
    };
    smallProjectArea: {
      findMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: USER_ID, status: 'active' }),
        create: jest.fn().mockResolvedValue({ id: USER_ID, name: 'New User', email: 'new@stada.dev', status: 'active', roles: [], roleAssignments: [] }),
        update: jest.fn().mockResolvedValue({}),
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      costCentre: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      smallProjectArea: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('updateUserRoles', () => {
    it('deletes existing, creates new, updates User.roles and writes audit log as last action', async () => {
      const callOrder: string[] = [];
      prisma.userRoleAssignment.findMany.mockResolvedValue([{ role: 'DemandRequester', scopeType: 'global', scopeId: null }]);
      prisma.userRoleAssignment.deleteMany.mockImplementation(async () => { callOrder.push('deleteMany'); return { count: 1 }; });
      prisma.userRoleAssignment.createMany.mockImplementation(async () => { callOrder.push('createMany'); return { count: 1 }; });
      prisma.user.update.mockImplementation(async () => { callOrder.push('userUpdate'); return {}; });
      prisma.auditLog.create.mockImplementation(async () => { callOrder.push('auditLog'); return {}; });

      await service.updateUserRoles(
        USER_ID,
        { assignments: [{ role: 'Admin', scopeType: 'global', areaIds: [], countryIds: [] }] },
        ADMIN_ID,
      );

      expect(callOrder).toEqual(['deleteMany', 'createMany', 'userUpdate', 'auditLog']);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'User',
            entityId: USER_ID,
            eventType: 'ROLE_ASSIGNED',
            changedBy: ADMIN_ID,
          }),
        }),
      );
    });

    it('deduplicates roles in User.roles update', async () => {
      await service.updateUserRoles(
        USER_ID,
        {
          assignments: [
            { role: 'DemandManager', scopeType: 'area', areaIds: ['area-1'], countryIds: [] },
          ],
        },
        ADMIN_ID,
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { roles: ['DemandManager'] },
        }),
      );
    });

    it('writes empty roles array when all assignments removed', async () => {
      await service.updateUserRoles(USER_ID, { assignments: [] }, ADMIN_ID);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { roles: [] } }),
      );
      expect(prisma.userRoleAssignment.createMany).not.toHaveBeenCalled();
    });

    it('throws 422 when global-only role is given cost_centre scope', async () => {
      await expect(
        service.updateUserRoles(
          USER_ID,
          { assignments: [{ role: 'Admin', scopeType: 'cost_centre', scopeId: CC_ID, areaIds: [], countryIds: [] }] },
          ADMIN_ID,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when area role (DM) is given global scope', async () => {
      await expect(
        service.updateUserRoles(
          USER_ID,
          { assignments: [{ role: 'DemandManager', scopeType: 'global', areaIds: [], countryIds: [] }] },
          ADMIN_ID,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when area role (DM) is given cost_centre scope', async () => {
      await expect(
        service.updateUserRoles(
          USER_ID,
          { assignments: [{ role: 'DemandManager', scopeType: 'cost_centre', scopeId: CC_ID, areaIds: [], countryIds: [] }] },
          ADMIN_ID,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when area role (DM) has countryIds without areaIds (AC-3.10)', async () => {
      await expect(
        service.updateUserRoles(
          USER_ID,
          { assignments: [{ role: 'DemandManager', scopeType: 'area', areaIds: [], countryIds: ['country-1'] }] },
          ADMIN_ID,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when scopeType is legal_entity', async () => {
      await expect(
        service.updateUserRoles(
          USER_ID,
          { assignments: [{ role: 'DemandManager', scopeType: 'legal_entity', scopeId: 'le-1', areaIds: [], countryIds: [] }] },
          ADMIN_ID,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 404 when userId does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUserRoles(USER_ID, { assignments: [] }, ADMIN_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRoutingHealth', () => {
    it('returns hasPmGap true for cost centre with no PM assignment', async () => {
      prisma.costCentre.findMany.mockResolvedValue([{ id: CC_ID, code: 'CC-001', name: 'IT' }]);
      prisma.smallProjectArea.findMany.mockResolvedValue([]);
      prisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const result = await service.getRoutingHealth();

      expect(result.costCentreHealth).toHaveLength(1);
      expect(result.costCentreHealth[0].hasPmGap).toBe(true);
    });

    it('returns hasDmGap true for area with no DM assignment', async () => {
      prisma.costCentre.findMany.mockResolvedValue([]);
      prisma.smallProjectArea.findMany.mockResolvedValue([{ id: 'area-1', code: 'A-001', name: 'Digital' }]);
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);

      const result = await service.getRoutingHealth();

      expect(result.areaHealth).toHaveLength(1);
      expect(result.areaHealth[0].hasDmGap).toBe(true);
      expect(result.areaHealth[0].hasBcGap).toBe(true);
    });

    it('returns hasDmGap false when a DM assignment exists for that area', async () => {
      prisma.costCentre.findMany.mockResolvedValue([]);
      prisma.smallProjectArea.findMany.mockResolvedValue([{ id: 'area-1', code: 'A-001', name: 'Digital' }]);
      // findFirst is called: DM for area-1, then BC for area-1
      prisma.userRoleAssignment.findFirst
        .mockResolvedValueOnce({ user: { id: USER_ID, name: 'Carol DM', email: 'carol@example.com' } })  // DM
        .mockResolvedValueOnce(null); // BC

      const result = await service.getRoutingHealth();

      expect(result.areaHealth[0].hasDmGap).toBe(false);
      expect(result.areaHealth[0].demandManager).toEqual({ id: USER_ID, name: 'Carol DM', email: 'carol@example.com' });
    });

    it('includes global PortfolioManager on all cost centres', async () => {
      prisma.costCentre.findMany.mockResolvedValue([
        { id: 'cc-1', code: 'CC-001', name: 'IT' },
        { id: 'cc-2', code: 'CC-002', name: 'HR' },
      ]);
      prisma.smallProjectArea.findMany.mockResolvedValue([]);
      prisma.userRoleAssignment.findMany.mockResolvedValue([
        { scopeType: 'global', scopeId: null, user: { id: 'pm-1', name: 'David PM' } },
      ]);

      const result = await service.getRoutingHealth();

      expect(result.costCentreHealth[0].portfolioManagers).toEqual([{ userId: 'pm-1', name: 'David PM' }]);
      expect(result.costCentreHealth[1].portfolioManagers).toEqual([{ userId: 'pm-1', name: 'David PM' }]);
      expect(result.costCentreHealth[0].hasPmGap).toBe(false);
      expect(result.costCentreHealth[1].hasPmGap).toBe(false);
    });
  });

  describe('listUsers', () => {
    const makeUser = (overrides = {}) => ({
      id: USER_ID, email: 'a@stada.dev', name: 'Alice', status: 'active', roles: [], roleAssignments: [],
      ...overrides,
    });

    it('returns all users ordered by name when no filters given', async () => {
      prisma.user.findMany.mockResolvedValue([makeUser()]);
      const result = await service.listUsers();
      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('passes search filter as insensitive contains on name/email', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.listUsers({ search: 'alice' });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { name: { contains: 'alice', mode: 'insensitive' } },
                  { email: { contains: 'alice', mode: 'insensitive' } },
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('passes role filter as roleAssignments.some', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.listUsers({ role: 'Admin' });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { roleAssignments: { some: { role: 'Admin' } } },
            ]),
          }),
        }),
      );
    });

    it('passes costCentreId filter as roleAssignments.some scopeId', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.listUsers({ costCentreId: CC_ID });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { roleAssignments: { some: { scopeId: CC_ID } } },
            ]),
          }),
        }),
      );
    });

    it('ANDs multiple filters', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.listUsers({ search: 'bob', role: 'Admin', costCentreId: CC_ID });
      const call = prisma.user.findMany.mock.calls[0][0];
      // 4 entries: search, role, costCentreId, areaId (empty {} when not provided)
      expect(call.where.AND).toHaveLength(4);
    });
  });

  describe('createUser', () => {
    const dto = { name: 'New User', email: 'new@stada.dev' };

    it('creates user and audit log in one transaction; audit log is last', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const callOrder: string[] = [];
      prisma.user.create.mockImplementation(async () => {
        callOrder.push('userCreate');
        return { id: USER_ID, name: dto.name, email: dto.email, status: 'active', roles: [], roleAssignments: [] };
      });
      prisma.auditLog.create.mockImplementation(async () => { callOrder.push('auditLog'); return {}; });

      await service.createUser(dto, ADMIN_ID);

      expect(callOrder).toEqual(['userCreate', 'auditLog']);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'USER_CREATED',
            changedBy: ADMIN_ID,
            before: null,
            after: { name: dto.name, email: dto.email },
          }),
        }),
      );
    });

    it('returns UserAdminRow with empty assignments on success', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.createUser(dto, ADMIN_ID);
      expect(result).toMatchObject({ id: USER_ID, name: 'New User', email: 'new@stada.dev', assignments: [] });
    });

    it('throws ConflictException if email already exists without entering transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id' });
      await expect(service.createUser(dto, ADMIN_ID)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('updateUserStatus', () => {
    it('updates status and writes audit log as last action in transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, status: 'active' });
      const callOrder: string[] = [];
      prisma.user.update.mockImplementation(async () => { callOrder.push('userUpdate'); return {}; });
      prisma.auditLog.create.mockImplementation(async () => { callOrder.push('auditLog'); return {}; });

      await service.updateUserStatus(USER_ID, { status: 'departed' }, ADMIN_ID);

      expect(callOrder).toEqual(['userUpdate', 'auditLog']);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'USER_STATUS_CHANGED',
            changedBy: ADMIN_ID,
            before: { status: 'active' },
            after: { status: 'departed' },
          }),
        }),
      );
    });

    it('throws NotFoundException when userId not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUserStatus(USER_ID, { status: 'departed' }, ADMIN_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException for retention_only user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, status: 'retention_only' });
      await expect(service.updateUserStatus(USER_ID, { status: 'active' }, ADMIN_ID)).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
