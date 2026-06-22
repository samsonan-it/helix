import { z } from 'zod';

export const VALID_ROLES = [
  'Admin', 'DemandRequester', 'BusinessController', 'DemandManager',
  'PortfolioManager', 'ProjectManager', 'TeamMember', 'ITCostCenterOwner', 'SECMember',
] as const;

export const roleAssignmentSchema = z.object({
  role: z.enum(VALID_ROLES),
  scopeType: z.enum(['global', 'area', 'cost_centre', 'legal_entity']),
  scopeId: z.string().min(1).optional(),
  areaIds: z.array(z.string()).default([]),
  countryIds: z.array(z.string()).default([]),
}).superRefine((val, ctx) => {
  if (val.areaIds.length === 0 && val.countryIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'countryIds can only be set when areaIds is non-empty',
      path: ['countryIds'],
    });
  }
});

export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;

export const updateUserRolesSchema = z.object({
  assignments: z.array(roleAssignmentSchema),
});

export type UpdateUserRolesDto = z.infer<typeof updateUserRolesSchema>;

export const userAdminRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  status: z.string(),
  roles: z.array(z.string()),
  assignments: z.array(roleAssignmentSchema),
});

export type UserAdminRow = z.infer<typeof userAdminRowSchema>;

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const USER_MUTABLE_STATUSES = ['active', 'departed'] as const;
export const updateUserStatusSchema = z.object({
  status: z.enum(USER_MUTABLE_STATUSES),
});
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  costCentreId: z.string().optional(),
  areaId: z.string().optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const routingHealthRowSchema = z.object({
  costCentreId: z.string(),
  code: z.string(),
  name: z.string(),
  demandManagers: z.array(z.object({ userId: z.string(), name: z.string() })),
  portfolioManagers: z.array(z.object({ userId: z.string(), name: z.string() })),
  hasDmGap: z.boolean(),
  hasPmGap: z.boolean(),
});

export type RoutingHealthRow = z.infer<typeof routingHealthRowSchema>;

export const areaRoutingHealthRowSchema = z.object({
  areaId: z.string(),
  areaCode: z.string(),
  areaName: z.string(),
  demandManager: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  businessController: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  hasDmGap: z.boolean(),
  hasBcGap: z.boolean(),
});

export type AreaRoutingHealthRow = z.infer<typeof areaRoutingHealthRowSchema>;

export const routingHealthResponseSchema = z.object({
  costCentreHealth: z.array(routingHealthRowSchema),
  areaHealth: z.array(areaRoutingHealthRowSchema),
});

export type RoutingHealthResponse = z.infer<typeof routingHealthResponseSchema>;
