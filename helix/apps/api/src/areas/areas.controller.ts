import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AreasService } from './areas.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { AreaResponse } from '@helix/shared';

@ApiTags('areas')
@ApiCookieAuth('helix-session')
@Controller('areas')
@UseGuards(SessionAuthGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  @ApiOperation({ summary: 'List all active areas' })
  findAll(): Promise<AreaResponse[]> {
    return this.areasService.findAllActive();
  }
}
