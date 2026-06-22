import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, AuthUser } from '@helix/types';
import { DemandStatus } from '@helix/shared';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PortfolioService } from './portfolio.service';
import { PortfolioListResponse } from './portfolio.types';

const VALID_STATUSES = new Set<string>(Object.values(DemandStatus));

@ApiTags('portfolio')
@ApiCookieAuth('helix-session')
@UseGuards(SessionAuthGuard, RolesGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  @Roles(Role.PortfolioManager)
  @ApiOperation({ summary: 'Get portfolio demand list with filters' })
  getPortfolioList(
    @CurrentUser() user: AuthUser,
    @Query('preset') preset?: string,
    @Query('year') year?: string,
    @Query('status') status?: string,
    @Query('demandType') demandType?: string,
    @Query('pmId') pmId?: string,
    @Query('areaId') areaId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PortfolioListResponse> {
    const parsedYear = year ? parseInt(year, 10) : NaN;
    const parsedPage = page ? parseInt(page, 10) : NaN;
    const parsedPageSize = pageSize ? parseInt(pageSize, 10) : NaN;
    return this.portfolioService.getPortfolioList(user.id, {
      preset: preset || 'ACTIVE',
      year: !isNaN(parsedYear) ? parsedYear : undefined,
      status: status && VALID_STATUSES.has(status) ? status : undefined,
      demandType: demandType || undefined,
      pmId: pmId || undefined,
      areaId: areaId || undefined,
      page: !isNaN(parsedPage) ? parsedPage : 1,
      pageSize: !isNaN(parsedPageSize) ? Math.min(parsedPageSize, 100) : 50,
    });
  }
}
