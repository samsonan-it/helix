import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CostCentresService } from './cost-centres.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { CostCentreResponse } from '@helix/shared';

@ApiTags('cost-centres')
@ApiCookieAuth('helix-session')
@Controller('cost-centres')
@UseGuards(SessionAuthGuard)
export class CostCentresController {
  constructor(private readonly costCentresService: CostCentresService) {}

  @Get()
  @ApiOperation({ summary: 'List all active cost centres' })
  findAll(): Promise<CostCentreResponse[]> {
    return this.costCentresService.findAllActive();
  }
}
