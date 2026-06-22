import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, Role } from '@helix/types';
import { ProjectHistoryItem, closureSubmitSchema, replaceProjectPlanSchema, updateCharterSchema, updateFinancialPlanEntriesSchema, updateInternalOrdersSchema, UpdateFinancialPlanEntriesDto } from '@helix/shared';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ProjectsService } from './projects.service';
import { FinancialPlansService } from '../financial-plans/financial-plans.service';
import { ProjectDetail, ProjectItem, ProjectListResponse, ProjectPlanResponse } from './projects.types';

const ALLOWED_HANDOVER_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const STAGE_VALUES = ['Initiation', 'Implementation', 'Testing', 'Go-Live', 'Hypercare', 'Closure'] as const;

class UpdateCurrentStageDto {
  stage!: string;
  comment?: string;
}

@ApiTags('projects')
@ApiCookieAuth('helix-session')
@UseGuards(SessionAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly financialPlansService: FinancialPlansService,
  ) {}

  private static readonly VALID_STATUSES = new Set([
    'DRAFT', 'PENDING_APPROVAL', 'IN_EXECUTION', 'ASSUMED_COMPLETED', 'PREPARE_FOR_CLOSURE', 'COMPLETED', 'CANCELLED',
  ]);

  @Get()
  @ApiOperation({ summary: 'List projects assigned to the current user' })
  getProjectList(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ProjectListResponse> {
    if (status && !ProjectsController.VALID_STATUSES.has(status)) {
      throw new BadRequestException(`Invalid status value: ${status}`);
    }
    const parsedPage = page ? parseInt(page, 10) : NaN;
    const parsedPageSize = pageSize ? parseInt(pageSize, 10) : NaN;
    return this.projectsService.getProjectList(user.id, {
      status: status || undefined,
      page: !isNaN(parsedPage) ? parsedPage : 1,
      pageSize: !isNaN(parsedPageSize) ? Math.min(parsedPageSize, 100) : 50,
      userRoles: user.roles as string[],
    });
  }

  @Get('closure-queue')
  @ApiOperation({ summary: 'List PREPARE_FOR_CLOSURE projects for PPM closure review' })
  getClosureQueue(@CurrentUser() user: AuthUser): Promise<ProjectItem[]> {
    return this.projectsService.getClosureQueue(user.id, user.roles as Role[]);
  }

  @Get('charter-queue')
  @ApiOperation({ summary: 'List PENDING_APPROVAL projects for PPM charter review' })
  getCharterQueue(@CurrentUser() user: AuthUser): Promise<ProjectItem[]> {
    return this.projectsService.getCharterQueue(user.id, user.roles as string[]);
  }

  @Post('bulk-internal-orders')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.BusinessController)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Bulk-import OPEX/CAPEX Internal Order numbers from CSV' })
  async bulkImportInternalOrders(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('overwrite') overwrite: string,
  ) {
    if (!file) throw new BadRequestException('CSV file is required');
    return this.projectsService.bulkImportInternalOrders(
      file,
      overwrite === 'true',
      user.id,
      user.roles as Role[],
    );
  }

  @Patch(':id/internal-orders')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.BusinessController)
  @ApiOperation({ summary: 'Update SAP Internal Order numbers on a project' })
  async updateInternalOrders(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const dto = updateInternalOrdersSchema.parse(body);
    return this.projectsService.updateInternalOrders(id, user.id, user.roles as Role[], dto);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get chronological audit history for a project' })
  getProjectHistory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ProjectHistoryItem[]> {
    return this.projectsService.getProjectHistory(id, user.id, user.roles as Role[]);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project detail by id' })
  getProject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ProjectDetail> {
    return this.projectsService.getProject(id, user.id, user.roles as Role[]);
  }

  @Patch(':id/current-stage')
  @HttpCode(204)
  @ApiOperation({ summary: 'Update the current stage of an IN_EXECUTION project' })
  updateCurrentStage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCurrentStageDto,
  ): Promise<void> {
    if (!dto.stage || !(STAGE_VALUES as readonly string[]).includes(dto.stage)) {
      throw new BadRequestException(`Invalid stage value: ${dto.stage}`);
    }
    return this.projectsService.updateCurrentStage(id, user.id, user.roles as Role[], dto.stage as typeof STAGE_VALUES[number], dto.comment);
  }

  @Patch(':id/charter')
  @HttpCode(204)
  @ApiOperation({ summary: 'Auto-save charter fields' })
  async updateCharter(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const dto = updateCharterSchema.parse(body);
    return this.projectsService.updateCharter(id, user.id, user.roles as Role[], dto);
  }

  @Post(':id/charter/submit')
  @HttpCode(204)
  @ApiOperation({ summary: 'Submit charter for PPM approval (DRAFT → PENDING_APPROVAL)' })
  submitCharter(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.projectsService.submitCharter(id, user.id);
  }

  @Post(':id/charter/approve')
  @HttpCode(204)
  @ApiOperation({ summary: 'Approve charter and start project (PENDING_APPROVAL → IN_EXECUTION)' })
  async approveCharter(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.projectsService.approveCharter(id, user.id, user.roles as string[]);
  }

  @Post(':id/charter/return')
  @HttpCode(204)
  @ApiOperation({ summary: 'Return charter for rework (PENDING_APPROVAL → DRAFT)' })
  async returnCharter(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { comment: string },
  ): Promise<void> {
    return this.projectsService.returnCharter(id, user.id, user.roles as string[], body?.comment ?? '');
  }

  @Post(':id/closure/handover-document')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('handoverDocument', {
    storage: memoryStorage(),
    // Mime-type check is client-reported; for MVP this is sufficient.
    fileFilter: (_req, file, cb) => {
      cb(null, ALLOWED_HANDOVER_MIME.has(file.mimetype));
    },
  }))
  @ApiOperation({ summary: 'Upload signed handover document for closure' })
  async uploadHandoverDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ fileName: string }> {
    if (!file) throw new BadRequestException('No valid file uploaded (must be PDF/DOC/DOCX ≤ 25 MB)');
    if (file.size > 26_214_400) throw new BadRequestException('File exceeds the 25 MB limit');
    return this.projectsService.uploadHandoverDocument(id, user.id, user.roles as Role[], file);
  }

  @Post(':id/closure/submit')
  @HttpCode(204)
  @ApiOperation({ summary: 'Submit closure form (PREPARE_FOR_CLOSURE → awaiting PPM review)' })
  async submitClosure(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const dto = closureSubmitSchema.parse(body);
    return this.projectsService.submitClosure(id, user.id, user.roles as Role[], dto);
  }

  @Post(':id/closure/accept')
  @HttpCode(204)
  @ApiOperation({ summary: 'Accept project closure (PREPARE_FOR_CLOSURE → COMPLETED)' })
  async acceptClosure(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.projectsService.acceptClosure(id, user.id, user.roles as Role[]);
  }

  @Post(':id/closure/return')
  @HttpCode(204)
  @ApiOperation({ summary: 'Return closure for rework (PREPARE_FOR_CLOSURE → IN_EXECUTION)' })
  async returnClosure(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { comment: string },
  ): Promise<void> {
    return this.projectsService.returnClosure(id, user.id, user.roles as Role[], typeof body?.comment === 'string' ? body.comment : '');
  }

  @Get(':id/plan')
  @ApiOperation({ summary: 'Get project plan items' })
  getProjectPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ProjectPlanResponse> {
    return this.projectsService.getProjectPlan(id, user.id, user.roles as Role[]);
  }

  @Put(':id/plan')
  @HttpCode(204)
  @ApiOperation({ summary: 'Replace project plan (full list replace)' })
  async replaceProjectPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const dto = replaceProjectPlanSchema.parse(body);
    return this.projectsService.replaceProjectPlan(id, user.id, user.roles as Role[], dto);
  }

  @Get(':id/financial-plan')
  @UseGuards(RolesGuard)
  @Roles(Role.ProjectManager, Role.PortfolioManager, Role.Admin)
  @ApiOperation({ summary: 'Get financial plan for a project' })
  getProjectFinancialPlan(@Param('id') id: string) {
    return this.financialPlansService.getByProject(id);
  }

  @Patch(':id/financial-plan')
  @UseGuards(RolesGuard)
  @Roles(Role.ProjectManager)
  @ApiOperation({ summary: 'Patch financial plan entries for a project (assigned PM only)' })
  patchProjectFinancialPlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFinancialPlanEntriesSchema)) dto: UpdateFinancialPlanEntriesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financialPlansService.patchProjectCells(id, dto, user);
  }
}
