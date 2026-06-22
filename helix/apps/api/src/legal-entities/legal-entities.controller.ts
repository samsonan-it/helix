import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LegalEntitiesService } from './legal-entities.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { LegalEntityResponse } from '@helix/shared';

@ApiTags('legal-entities')
@ApiCookieAuth('helix-session')
@Controller('legal-entities')
@UseGuards(SessionAuthGuard)
export class LegalEntitiesController {
  constructor(private readonly legalEntitiesService: LegalEntitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all active legal entities' })
  findAll(): Promise<LegalEntityResponse[]> {
    return this.legalEntitiesService.findAllActive();
  }
}
