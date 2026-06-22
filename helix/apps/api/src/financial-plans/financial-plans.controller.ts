import {
  Body,
  Controller,
  Get,
  MethodNotAllowedException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinancialPlansService } from './financial-plans.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Role, AuthUser } from '@helix/types';
import {
  updateFinancialPlanEntriesSchema,
  UpdateFinancialPlanEntriesDto,
} from '@helix/shared';

@ApiTags('financial-plans')
@ApiCookieAuth('helix-session')
@Controller('demands/:id/financial-plan')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.DemandRequester, Role.DemandManager, Role.PortfolioManager, Role.BusinessController)
export class FinancialPlansController {
  constructor(private readonly service: FinancialPlansService) {}

  @Get()
  @ApiOperation({ summary: 'Get financial plan for a demand' })
  getFinancialPlan(@Param('id') id: string) {
    return this.service.getByDemand(id);
  }

  @Patch()
  @ApiOperation({ summary: 'Patch individual financial plan entries' })
  patchCells(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFinancialPlanEntriesSchema)) dto: UpdateFinancialPlanEntriesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.patchCells(id, dto, user);
  }

  @Post('distribute')
  @ApiOperation({ summary: 'Distribute endpoint removed — method not allowed' })
  distribute() {
    throw new MethodNotAllowedException('The distribute endpoint has been removed');
  }
}
