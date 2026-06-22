import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@helix/types';
import { AuthUser } from '@helix/types';
import {
  UserAdminRow,
  UpdateUserRolesDto,
  RoutingHealthResponse,
  updateUserRolesSchema,
  createUserSchema,
  updateUserStatusSchema,
  listUsersQuerySchema,
  CreateUserDto,
  UpdateUserStatusDto,
} from '@helix/shared';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiCookieAuth('helix-session')
@Controller('admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users with role assignments' })
  listUsers(@Query() rawQuery: Record<string, string>): Promise<UserAdminRow[]> {
    const query = listUsersQuerySchema.parse(rawQuery);
    return this.adminService.listUsers(query);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new user' })
  @HttpCode(201)
  createUser(
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<UserAdminRow> {
    return this.adminService.createUser(dto, admin.id);
  }

  @Patch('users/:userId/status')
  @ApiOperation({ summary: 'Update user status (active/departed)' })
  @HttpCode(200)
  updateUserStatus(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) dto: UpdateUserStatusDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.adminService.updateUserStatus(userId, dto, admin.id);
  }

  @Put('users/:userId/roles')
  @ApiOperation({ summary: 'Replace role assignments for a user' })
  @HttpCode(200)
  updateUserRoles(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateUserRolesSchema)) dto: UpdateUserRolesDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.adminService.updateUserRoles(userId, dto, admin.id);
  }

  @Get('routing-health')
  @ApiOperation({ summary: 'Routing health check — DM/BC coverage per area and PM coverage per cost centre' })
  getRoutingHealth(): Promise<RoutingHealthResponse> {
    return this.adminService.getRoutingHealth();
  }
}
