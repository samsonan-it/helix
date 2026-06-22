import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '@helix/types';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsResponse } from '@helix/shared';

@ApiTags('config')
@ApiCookieAuth('helix-session')
@Controller('config/system-settings')
@UseGuards(SessionAuthGuard)
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system settings (SP threshold, GxP milestone durations, intake window, budget cycle)' })
  async getSettings(@CurrentUser() _user: AuthUser): Promise<SystemSettingsResponse> {
    return this.systemSettingsService.getSettings();
  }
}
