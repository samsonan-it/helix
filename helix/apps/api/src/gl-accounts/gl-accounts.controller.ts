import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GlAccountsService } from './gl-accounts.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { GlAccountResponse } from '@helix/shared';

@ApiTags('gl-accounts')
@ApiCookieAuth('helix-session')
@Controller('gl-accounts')
@UseGuards(SessionAuthGuard)
export class GlAccountsController {
  constructor(private readonly glAccountsService: GlAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active GL accounts' })
  findAll(): Promise<GlAccountResponse[]> {
    return this.glAccountsService.findAllActive();
  }
}
