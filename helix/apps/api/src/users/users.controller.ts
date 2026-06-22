import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiCookieAuth('helix-session')
@Controller('users')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List active users filtered by role — for pickers' })
  async listByRole(@Query('role') role: string): Promise<{ id: string; name: string; email: string }[]> {
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        ...(role ? { roleAssignments: { some: { role } } } : {}),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }
}
