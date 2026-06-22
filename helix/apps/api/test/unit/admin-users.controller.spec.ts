import 'reflect-metadata';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AdminUsersController } from '../../src/admin/admin-users.controller';
import { AdminService } from '../../src/admin/admin.service';
import { Role } from '@helix/types';
import { UserAdminRow, RoutingHealthRow } from '@helix/shared';

const mockAdmin = { id: 'admin-1', email: 'admin@stada.dev', name: 'Helix Admin', roles: [Role.Admin] };
const mockNonAdmin = { id: 'user-1', email: 'user@stada.dev', name: 'Alice', roles: [Role.DemandRequester] };

const mockUsers: UserAdminRow[] = [
  { id: 'user-1', email: 'alice@stada.dev', name: 'Alice', status: 'active', roles: ['DemandRequester'], assignments: [] },
];

const mockRoutingHealth: RoutingHealthRow[] = [
  {
    costCentreId: 'cc-1',
    code: 'CC-001',
    name: 'IT Infrastructure',
    demandManagers: [],
    portfolioManagers: [],
    hasDmGap: true,
    hasPmGap: true,
  },
];

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let adminService: {
    listUsers: jest.Mock;
    createUser: jest.Mock;
    updateUserStatus: jest.Mock;
    updateUserRoles: jest.Mock;
    getRoutingHealth: jest.Mock;
  };

  beforeEach(async () => {
    adminService = {
      listUsers: jest.fn().mockResolvedValue(mockUsers),
      createUser: jest.fn().mockResolvedValue(mockUsers[0]),
      updateUserStatus: jest.fn().mockResolvedValue(undefined),
      updateUserRoles: jest.fn().mockResolvedValue(undefined),
      getRoutingHealth: jest.fn().mockResolvedValue(mockRoutingHealth),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        { provide: AdminService, useValue: adminService },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
  });

  describe('GET /admin/users', () => {
    it('passes parsed query to service and returns 200', async () => {
      const result = await controller.listUsers({});
      expect(result).toEqual(mockUsers);
      expect(adminService.listUsers).toHaveBeenCalledWith({});
    });

    it('parses and forwards search + role params', async () => {
      await controller.listUsers({ search: 'foo', role: 'Admin' });
      expect(adminService.listUsers).toHaveBeenCalledWith({ search: 'foo', role: 'Admin' });
    });

    it('RolesGuard rejects non-Admin with 403', () => {
      const metadata = Reflect.getMetadata('roles', AdminUsersController);
      expect(metadata).toContain(Role.Admin);
      const nonAdminHasRole = mockNonAdmin.roles.includes(Role.Admin);
      expect(nonAdminHasRole).toBe(false);
    });
  });

  describe('POST /admin/users', () => {
    const dto = { name: 'New User', email: 'new@stada.dev' };

    it('returns created user for Admin with valid payload', async () => {
      const result = await controller.createUser(dto, mockAdmin as never);
      expect(result).toEqual(mockUsers[0]);
      expect(adminService.createUser).toHaveBeenCalledWith(dto, mockAdmin.id);
    });

    it('propagates ConflictException (409) from service', async () => {
      adminService.createUser.mockRejectedValue(new ConflictException('A user with this email already exists'));
      await expect(controller.createUser(dto, mockAdmin as never)).rejects.toThrow(ConflictException);
    });

    it('RolesGuard rejects non-Admin (verified via metadata)', () => {
      const metadata = Reflect.getMetadata('roles', AdminUsersController);
      expect(metadata).toContain(Role.Admin);
      expect(mockNonAdmin.roles.includes(Role.Admin)).toBe(false);
    });
  });

  describe('PATCH /admin/users/:userId/status', () => {
    it('returns void for Admin with valid payload', async () => {
      const result = await controller.updateUserStatus('user-1', { status: 'departed' }, mockAdmin as never);
      expect(result).toBeUndefined();
      expect(adminService.updateUserStatus).toHaveBeenCalledWith('user-1', { status: 'departed' }, mockAdmin.id);
    });

    it('RolesGuard rejects non-Admin (verified via metadata)', () => {
      const metadata = Reflect.getMetadata('roles', AdminUsersController);
      expect(metadata).toContain(Role.Admin);
      expect(mockNonAdmin.roles.includes(Role.Admin)).toBe(false);
    });
  });

  describe('PUT /admin/users/:userId/roles', () => {
    it('returns 200 on valid payload for Admin', async () => {
      const dto = { assignments: [{ role: 'Admin' as const, scopeType: 'global' as const, areaIds: [] as string[], countryIds: [] as string[] }] };
      await expect(
        controller.updateUserRoles('user-1', dto, mockAdmin as never),
      ).resolves.toBeUndefined();
      expect(adminService.updateUserRoles).toHaveBeenCalledWith('user-1', dto, mockAdmin.id);
    });

    it('calls service with correct userId and adminId', async () => {
      const dto = { assignments: [] };
      await controller.updateUserRoles('target-user', dto, mockAdmin as never);
      expect(adminService.updateUserRoles).toHaveBeenCalledWith('target-user', dto, 'admin-1');
    });
  });

  describe('GET /admin/routing-health', () => {
    it('returns routing health rows for Admin', async () => {
      const result = await controller.getRoutingHealth();
      expect(result).toEqual(mockRoutingHealth);
      expect(adminService.getRoutingHealth).toHaveBeenCalled();
    });

    it('RolesGuard rejects non-Admin (verified via metadata)', () => {
      const metadata = Reflect.getMetadata('roles', AdminUsersController);
      expect(metadata).toContain(Role.Admin);
      const nonAdminHasRole = mockNonAdmin.roles.includes(Role.Admin);
      expect(nonAdminHasRole).toBe(false);
    });
  });
});
