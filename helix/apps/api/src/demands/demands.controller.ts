import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DemandsService } from './demands.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FlagService } from '../config/flag.service';
import { FlagKeys } from '../config/flag-keys';
import { AiService } from '../modules/ai/ai.service';
import { Role, AuthUser } from '@helix/types';
import {
  bcRejectSchema,
  bcSendToRequesterSchema,
  createDemandSchema,
  updateDraftDemandSchema,
  updateDemandDatesSchema,
  aiPrefillRequestSchema,
  dmAcceptSchema,
  dmReturnSchema,
  dmRejectSchema,
  dmPostponeSchema,
  pmApproveSchema,
  pmRejectSchema,
  pmSendBackSchema,
  spReworkOfferSchema,
  BcQueueItem,
  BcRejectDto,
  BcSendToRequesterDto,
  CreateDemandDto,
  UpdateDraftDemandDto,
  DemandResponse,
  DashboardStatsResponse,
  DmQueueItem,
  PmQueueItem,
  UnifiedQueueItem,
  DemandHistoryItem,
  DmAcceptDto,
  DmReturnDto,
  DmRejectDto,
  DmPostponeDto,
  PmApproveDto,
  PmRejectDto,
  PmSendBackDto,
  SpReworkOfferDto,
  UpdateDemandDatesDto,
  AIPrefillRequest,
  AIPrefillResponse,
  saveDmAssessmentDraftSchema,
  SaveDmAssessmentDraftDto,
} from '@helix/shared';

@ApiTags('demands')
@ApiCookieAuth('helix-session')
@Controller('demands')
@UseGuards(SessionAuthGuard, RolesGuard)
export class DemandsController {
  constructor(
    private readonly demandsService: DemandsService,
    private readonly flagService: FlagService,
    private readonly aiService: AiService,
  ) {}

  @Post('prefill')
  @Roles(Role.DemandRequester)
  @ApiOperation({ summary: 'AI prefill demand fields from free-text description' })
  async prefillDemand(
    @Body(new ZodValidationPipe(aiPrefillRequestSchema)) body: AIPrefillRequest,
    @CurrentUser() _user: AuthUser,
  ): Promise<AIPrefillResponse> {
    const isEnabled = await this.flagService.get(FlagKeys.AI_PREFILL);
    if (!isEnabled) throw new NotFoundException('AI prefill is disabled');

    const timeout = new Promise<AIPrefillResponse>((_, reject) =>
      setTimeout(() => reject(new Error('AI service timeout')), 3000),
    );
    return Promise.race([this.aiService.prefillDemand(body.description), timeout]);
  }

  @Post()
  @Roles(Role.DemandRequester)
  @ApiOperation({ summary: 'Create a new DRAFT demand' })
  createDraft(
    @Body(new ZodValidationPipe(createDemandSchema)) body: CreateDemandDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.createDraft(body, user.id);
  }

  @Delete(':id')
  @Roles(Role.DemandRequester)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a DRAFT demand (own demands only)' })
  deleteDraft(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.demandsService.deleteDraft(id, user.id);
  }

  @Patch(':id')
  @Roles(Role.DemandRequester)
  @ApiOperation({ summary: 'Update fields on a DRAFT demand (own demands only)' })
  updateDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDraftDemandSchema)) body: UpdateDraftDemandDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.updateDraft(id, body, user.id);
  }

  @Patch(':id/dates')
  @Roles(Role.DemandManager)
  @ApiOperation({ summary: 'DM updates start/end dates on a SUBMITTED or REROUTED demand' })
  updateDemandDates(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDemandDatesSchema)) body: UpdateDemandDatesDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.updateDemandDates(id, body, user.id);
  }

  @Patch(':id/assessment')
  @Roles(Role.DemandManager)
  @ApiOperation({ summary: 'DM saves assessment fields as draft (no status transition)' })
  saveDmAssessmentDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDmAssessmentDraftSchema)) body: SaveDmAssessmentDraftDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.saveDmAssessmentDraft(id, user.id, body);
  }

  @Post(':id/submit')
  @Roles(Role.DemandRequester)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a DRAFT demand for review' })
  async submitDemand(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.submitDemand(id, user.id);
  }

  // GET /queue MUST be declared before GET /:id to avoid NestJS treating 'queue' as an :id param
  @Get('queue')
  @Roles(Role.DemandManager)
  @ApiOperation({ summary: 'Get DM action queue — SUBMITTED demands scoped to DM cost centres' })
  getDmQueue(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('stalledOnly') stalledOnly?: string,
  ): Promise<DmQueueItem[]> {
    return this.demandsService.getDmQueue(user.id, {
      status,
      search,
      stalledOnly: stalledOnly === 'true',
    });
  }

  // GET /pm-queue MUST be declared before GET /:id
  @Get('pm-queue')
  @Roles(Role.PortfolioManager)
  @ApiOperation({ summary: 'Get PM action queue — IN_REVIEW demands scoped to PM' })
  getPmQueue(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('stalledOnly') stalledOnly?: string,
  ): Promise<PmQueueItem[]> {
    return this.demandsService.getPmQueue(user.id, {
      status,
      search,
      stalledOnly: stalledOnly === 'true',
    });
  }

  // GET /dashboard-stats MUST be declared before GET /:id
  @Get('dashboard-stats')
  @Roles(Role.SECMember, Role.Admin)
  @ApiOperation({ summary: 'Get executive dashboard stats — active demands, budget, stalled' })
  getDashboardStats(): Promise<DashboardStatsResponse> {
    return this.demandsService.getDashboardStats();
  }

  // GET /bc-queue MUST be declared before GET /:id
  @Get('bc-queue')
  @Roles(Role.BusinessController)
  @ApiOperation({ summary: 'Get BC action queue — BC_REVIEW demands scoped to BC' })
  getBcQueue(@CurrentUser() user: AuthUser): Promise<BcQueueItem[]> {
    return this.demandsService.getBcQueue(user.id);
  }

  // GET /unified-queue MUST be declared before GET /:id
  @Get('unified-queue')
  @Roles(Role.DemandManager, Role.BusinessController, Role.PortfolioManager)
  @ApiOperation({ summary: 'Get unified action queue — all roles merged, sorted by urgency' })
  getUnifiedQueue(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('stalledOnly') stalledOnly?: string,
    @Query('onHoldOnly') onHoldOnly?: string,
  ): Promise<UnifiedQueueItem[]> {
    return this.demandsService.getUnifiedQueue(user.id, {
      search: search || undefined,
      stalledOnly: stalledOnly === 'true',
      onHoldOnly: onHoldOnly === 'true',
    });
  }

  // GET /:id/history MUST be declared before GET /:id
  @Get(':id/history')
  @Roles(Role.DemandRequester, Role.DemandManager, Role.PortfolioManager, Role.BusinessController)
  @ApiOperation({ summary: 'Get chronological audit history for a demand' })
  getDemandHistory(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandHistoryItem[]> {
    return this.demandsService.getDemandHistory(id, user.id, user.roles);
  }

  @Get(':id')
  @Roles(Role.DemandRequester, Role.DemandManager, Role.PortfolioManager, Role.BusinessController)
  @ApiOperation({ summary: 'Fetch a single demand by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.findOne(id, user.id, user.roles);
  }

  @Get()
  @Roles(Role.DemandRequester, Role.DemandManager, Role.PortfolioManager)
  @ApiOperation({ summary: 'List demands (own for DemandRequester, all for managers)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('publicId') publicId?: string,
  ): Promise<DemandResponse[]> {
    const parsedPublicId = publicId !== undefined ? parseInt(publicId, 10) : undefined;
    const validPublicId = parsedPublicId !== undefined && !isNaN(parsedPublicId) && String(parsedPublicId) === publicId
      ? parsedPublicId
      : undefined;
    return this.demandsService.findAll(user.id, user.roles, { publicId: validPublicId });
  }

  @Post(':id/accept')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DM accepts demand — SUBMITTED → IN_REVIEW' })
  dmAccept(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dmAcceptSchema)) body: DmAcceptDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.dmAccept(id, user.id, body);
  }

  @Post(':id/return')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DM returns demand for rework — SUBMITTED → REROUTED' })
  dmReturn(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dmReturnSchema)) body: DmReturnDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.dmReturn(id, user.id, body);
  }

  @Post(':id/reject')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DM rejects demand — SUBMITTED → REJECTED' })
  dmReject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dmRejectSchema)) body: DmRejectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.dmReject(id, user.id, body);
  }

  @Post(':id/postpone')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DM postpones demand — SUBMITTED → ON_HOLD' })
  dmPostpone(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dmPostponeSchema)) body: DmPostponeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.dmPostpone(id, user.id, body);
  }

  @Post(':id/resume')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DM resumes postponed demand — ON_HOLD → SUBMITTED' })
  dmResume(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.dmResume(id, user.id);
  }

  @Post(':id/approve')
  @Roles(Role.PortfolioManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PM approves demand — IN_REVIEW → APPROVED + project stub' })
  pmApprove(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(pmApproveSchema)) body: PmApproveDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.pmApprove(id, user.id, body);
  }

  @Post(':id/pm-reject')
  @Roles(Role.PortfolioManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PM rejects demand — IN_REVIEW → REJECTED' })
  pmReject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(pmRejectSchema)) body: PmRejectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.pmReject(id, user.id, body);
  }

  @Post(':id/pm-send-back')
  @Roles(Role.PortfolioManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PM sends demand back to requester (REROUTED) or DM (SUBMITTED)' })
  pmSendBack(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(pmSendBackSchema)) body: PmSendBackDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.pmSendBack(id, user.id, body);
  }

  @Post(':id/sp-accept')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SP: DM accepts at DM Review — sets spStep=DM_COST_ESTIMATION' })
  spAccept(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.spAccept(id, user.id);
  }

  @Post(':id/sp-submit-estimate')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SP: DM submits OPEX cost estimate — SUBMITTED/REROUTED → SP_OFFER_REVIEW, spStep=DR_OFFER_REVIEW' })
  spSubmitEstimate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.spSubmitEstimate(id, user.id);
  }

  @Post(':id/sp-accept-and-estimate')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SP: DM accepts and submits estimate in one step — SUBMITTED → SP_OFFER_REVIEW, spStep=DR_OFFER_REVIEW' })
  spAcceptAndEstimate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.spAcceptAndEstimate(id, user.id);
  }

  @Post(':id/sp-accept-offer')
  @Roles(Role.DemandRequester)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SP: Originator accepts offer — spStep=PM_DECISION' })
  spAcceptOffer(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.spAcceptOffer(id, user.id);
  }

  @Post(':id/sp-rework-offer')
  @Roles(Role.DemandRequester)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SP: Originator requests rework — IN_REVIEW → REROUTED, spStep=DM_COST_ESTIMATION' })
  spReworkOffer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(spReworkOfferSchema)) body: SpReworkOfferDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.spReworkOffer(id, user.id, body);
  }

  @Post(':id/convert-to-sp')
  @Roles(Role.DemandManager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DM converts P demand to SP — distinct audit event, removes from BC queue if in BC_REVIEW' })
  convertToSmallProject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.convertToSmallProject(id, user.id);
  }

  @Post(':id/bc-approve')
  @Roles(Role.BusinessController)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BC approves demand — BC_REVIEW → IN_REVIEW' })
  bcApprove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.bcApprove(id, user.id);
  }

  @Post(':id/bc-reject')
  @Roles(Role.BusinessController)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BC rejects demand — BC_REVIEW → REJECTED' })
  bcReject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bcRejectSchema)) body: BcRejectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.bcReject(id, user.id, body);
  }

  @Post(':id/bc-send-to-requester')
  @Roles(Role.BusinessController)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BC sends demand back to requester — BC_REVIEW → REROUTED' })
  bcSendToRequester(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bcSendToRequesterSchema)) body: BcSendToRequesterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DemandResponse> {
    return this.demandsService.bcSendToRequester(id, user.id, body);
  }
}
