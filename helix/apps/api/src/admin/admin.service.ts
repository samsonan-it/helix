import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UserAdminRow,
  UpdateUserRolesDto,
  RoutingHealthResponse,
  RoleAssignment,
  CreateUserDto,
  UpdateUserStatusDto,
  ListUsersQuery,
} from '@helix/shared';

// DM and BC are area-scoped (Story 3.8)
const AREA_SCOPED_ROLES = new Set(['DemandManager', 'BusinessController']);
// ITCostCenterOwner stays cost-centre scoped
const COST_CENTRE_SCOPED_ROLES = new Set(['ITCostCenterOwner']);
// Roles that require global scope
const GLOBAL_ONLY_ROLES = new Set([
  'Admin', 'DemandRequester', 'PortfolioManager', 'SECMember', 'ProjectManager', 'TeamMember',
]);

function validateScopingRules(assignments: RoleAssignment[]): void {
  for (const a of assignments) {
    if (a.scopeType === 'legal_entity') {
      throw new UnprocessableEntityException(
        `scopeType 'legal_entity' is not supported for any role`,
      );
    }
    if (GLOBAL_ONLY_ROLES.has(a.role) && a.scopeType !== 'global') {
      throw new UnprocessableEntityException(
        `Role '${a.role}' must have scopeType 'global', got '${a.scopeType}'`,
      );
    }
    if (AREA_SCOPED_ROLES.has(a.role) && a.scopeType !== 'area') {
      throw new UnprocessableEntityException(
        `Role '${a.role}' must have scopeType 'area', got '${a.scopeType}'`,
      );
    }
    if (AREA_SCOPED_ROLES.has(a.role) && a.countryIds.length > 0 && a.areaIds.length === 0) {
      throw new UnprocessableEntityException(
        `Role '${a.role}' cannot have countryIds without areaIds`,
      );
    }
    if (COST_CENTRE_SCOPED_ROLES.has(a.role) && a.scopeType !== 'cost_centre') {
      throw new UnprocessableEntityException(
        `Role '${a.role}' must have scopeType 'cost_centre', got '${a.scopeType}'`,
      );
    }
    if (COST_CENTRE_SCOPED_ROLES.has(a.role) && !a.scopeId) {
      throw new UnprocessableEntityException(
        `Role '${a.role}' requires a scopeId`,
      );
    }
  }
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private mapUserRow(u: { id: string; email: string; name: string; status: string; roles: string[]; roleAssignments: { role: string; scopeType: string; scopeId: string | null; areaIds: string[]; countryIds: string[] }[] }): UserAdminRow {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      roles: u.roles,
      assignments: u.roleAssignments.map((a) => ({
        role: a.role as RoleAssignment['role'],
        scopeType: a.scopeType as RoleAssignment['scopeType'],
        scopeId: a.scopeId ?? undefined,
        areaIds: a.areaIds,
        countryIds: a.countryIds,
      })),
    };
  }

  async listUsers(query: ListUsersQuery = {}): Promise<UserAdminRow[]> {
    const { search, role, costCentreId, areaId } = query;
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          } : {},
          role ? { roleAssignments: { some: { role } } } : {},
          costCentreId ? { roleAssignments: { some: { scopeId: costCentreId } } } : {},
          areaId ? { roleAssignments: { some: { areaIds: { has: areaId } } } } : {},
        ],
      },
      include: { roleAssignments: true },
      orderBy: { name: 'asc' },
    });

    return users.map((u) => this.mapUserRow(u));
  }

  async createUser(dto: CreateUserDto, adminId: string): Promise<UserAdminRow> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    let createdUser: { id: string; email: string; name: string; status: string; roles: string[]; roleAssignments: { role: string; scopeType: string; scopeId: string | null; areaIds: string[]; countryIds: string[] }[] };

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: dto.name, email: dto.email, status: 'active', roles: [] },
        include: { roleAssignments: true },
      });
      createdUser = user;

      // LAST ACTION — audit log must be last per CLAUDE.md rule 8
      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: user.id,
          eventType: 'USER_CREATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: null as never,
          after: { name: dto.name, email: dto.email } as never,
        },
      });
    });

    return this.mapUserRow(createdUser!);
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto, adminId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (user.status === 'retention_only') {
      throw new UnprocessableEntityException('Cannot change status of a retention_only user');
    }
    if (user.status === dto.status) {
      return;
    }

    const before = { status: user.status };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: dto.status } });

      // LAST ACTION — audit log must be last per CLAUDE.md rule 8
      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: userId,
          eventType: 'USER_STATUS_CHANGED',
          changedBy: adminId,
          changedAt: new Date(),
          before: before as never,
          after: { status: dto.status } as never,
        },
      });
    });
  }

  async updateUserRoles(userId: string, dto: UpdateUserRolesDto, adminId: string): Promise<void> {
    validateScopingRules(dto.assignments);

    const userExists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      const before = await tx.userRoleAssignment.findMany({ where: { userId } });

      await tx.userRoleAssignment.deleteMany({ where: { userId } });

      if (dto.assignments.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: dto.assignments.map((a) => ({
            userId,
            role: a.role,
            scopeType: a.scopeType,
            scopeId: a.scopeId ?? null,
            areaIds: a.areaIds ?? [],
            countryIds: a.countryIds ?? [],
            assignedBy: adminId,
          })),
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { roles: [...new Set(dto.assignments.map((a) => a.role))] },
      });

      const beforeDto = before.map((a) => ({
        role: a.role,
        scopeType: a.scopeType,
        scopeId: a.scopeId ?? undefined,
        areaIds: (a as { areaIds?: string[] }).areaIds ?? [],
        countryIds: (a as { countryIds?: string[] }).countryIds ?? [],
      }));

      // LAST ACTION — audit log must be last per CLAUDE.md rule 8
      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: userId,
          eventType: 'ROLE_ASSIGNED',
          changedBy: adminId,
          changedAt: new Date(),
          before: beforeDto as never,
          after: dto.assignments as never,
        },
      });
    });
  }

  async getRoutingHealth(): Promise<RoutingHealthResponse> {
    const [costCentres, pmAssignments, areas] = await Promise.all([
      this.prisma.costCentre.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.userRoleAssignment.findMany({
        where: { role: 'PortfolioManager' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.smallProjectArea.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      }),
    ]);

    const costCentreHealth = costCentres.map((cc) => {
      const pms = pmAssignments
        .filter((a) => a.scopeId === cc.id || a.scopeType === 'global')
        .map((a) => ({ userId: a.user.id, name: a.user.name }));

      return {
        costCentreId: cc.id,
        code: cc.code,
        name: cc.name,
        demandManagers: [],
        portfolioManagers: pms,
        hasDmGap: false,
        hasPmGap: pms.length === 0,
      };
    });

    const areaHealth = await Promise.all(areas.map(async (area) => {
      const [dmAssignment, bcAssignment] = await Promise.all([
        this.prisma.userRoleAssignment.findFirst({
          where: {
            role: 'DemandManager',
            user: { status: 'active' },
            OR: [
              { areaIds: { isEmpty: true } },
              { areaIds: { has: area.id } },
            ],
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        this.prisma.userRoleAssignment.findFirst({
          where: {
            role: 'BusinessController',
            user: { status: 'active' },
            OR: [
              { areaIds: { isEmpty: true } },
              { areaIds: { has: area.id } },
            ],
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
      ]);

      return {
        areaId: area.id,
        areaCode: area.code,
        areaName: area.name,
        demandManager: dmAssignment ? { id: dmAssignment.user.id, name: dmAssignment.user.name, email: dmAssignment.user.email } : null,
        businessController: bcAssignment ? { id: bcAssignment.user.id, name: bcAssignment.user.name, email: bcAssignment.user.email } : null,
        hasDmGap: dmAssignment === null,
        hasBcGap: bcAssignment === null,
      };
    }));

    return { costCentreHealth, areaHealth };
  }
}
