import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FlagService } from './flag.service';
import { FlagKeys, FlagKey } from './flag-keys';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';

@ApiTags('flags')
@ApiCookieAuth('helix-session')
@Controller('flags')
@UseGuards(SessionAuthGuard)
export class FlagsController {
  constructor(private readonly flagService: FlagService) {}

  @Get()
  @ApiOperation({ summary: 'Get all feature flags' })
  async getAll(): Promise<Record<FlagKey, boolean>> {
    const keys = Object.values(FlagKeys) as FlagKey[];
    const entries = await Promise.all(
      keys.map(async (key) => [key, await this.flagService.get(key)] as const),
    );
    return Object.fromEntries(entries) as Record<FlagKey, boolean>;
  }
}
