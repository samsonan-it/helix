import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, AuthUser } from '@helix/types';
import {
  CostCentreAdminRow,
  CreateCostCentreDto,
  UpdateCostCentreDto,
  createCostCentreSchema,
  updateCostCentreSchema,
  GlAccountAdminRow,
  CreateGlAccountDto,
  UpdateGlAccountDto,
  createGlAccountSchema,
  updateGlAccountSchema,
  LegalEntityAdminRow,
  CreateLegalEntityDto,
  UpdateLegalEntityDto,
  createLegalEntitySchema,
  updateLegalEntitySchema,
  AreaAdminRow,
  CreateAreaDto,
  UpdateAreaDto,
  createAreaSchema,
  updateAreaSchema,
  CountryAdminRow,
  CreateCountryDto,
  UpdateCountryDto,
  createCountrySchema,
  updateCountrySchema,
} from '@helix/shared';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminReferenceDataService } from './admin-reference-data.service';

@ApiTags('admin')
@ApiCookieAuth('helix-session')
@Controller('admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminReferenceDataController {
  constructor(private readonly refDataService: AdminReferenceDataService) {}

  // ── Cost Centres ──────────────────────────────────────────────────

  @Get('cost-centres')
  @ApiOperation({ summary: 'List all cost centres (active + inactive)' })
  listCostCentres(): Promise<CostCentreAdminRow[]> {
    return this.refDataService.listCostCentres();
  }

  @Post('cost-centres')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new cost centre' })
  createCostCentre(
    @Body(new ZodValidationPipe(createCostCentreSchema)) dto: CreateCostCentreDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<CostCentreAdminRow> {
    return this.refDataService.createCostCentre(dto, admin.id);
  }

  @Patch('cost-centres/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a cost centre' })
  updateCostCentre(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCostCentreSchema)) dto: UpdateCostCentreDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<CostCentreAdminRow> {
    return this.refDataService.updateCostCentre(id, dto, admin.id);
  }

  @Patch('cost-centres/:id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a cost centre (blocked if in-flight demands exist)' })
  deactivateCostCentre(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.deactivateCostCentre(id, admin.id);
  }

  @Patch('cost-centres/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a cost centre' })
  activateCostCentre(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.activateCostCentre(id, admin.id);
  }

  // ── GL Accounts ───────────────────────────────────────────────────

  @Get('gl-accounts')
  @ApiOperation({ summary: 'List all GL accounts (active + inactive)' })
  listGlAccounts(): Promise<GlAccountAdminRow[]> {
    return this.refDataService.listGlAccounts();
  }

  @Post('gl-accounts')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new GL account' })
  createGlAccount(
    @Body(new ZodValidationPipe(createGlAccountSchema)) dto: CreateGlAccountDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<GlAccountAdminRow> {
    return this.refDataService.createGlAccount(dto, admin.id);
  }

  @Patch('gl-accounts/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a GL account' })
  updateGlAccount(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGlAccountSchema)) dto: UpdateGlAccountDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<GlAccountAdminRow> {
    return this.refDataService.updateGlAccount(id, dto, admin.id);
  }

  @Patch('gl-accounts/:id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a GL account' })
  deactivateGlAccount(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.deactivateGlAccount(id, admin.id);
  }

  @Patch('gl-accounts/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a GL account' })
  activateGlAccount(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.activateGlAccount(id, admin.id);
  }

  // ── Legal Entities ────────────────────────────────────────────────

  @Get('legal-entities')
  @ApiOperation({ summary: 'List all legal entities (active + inactive)' })
  listLegalEntities(): Promise<LegalEntityAdminRow[]> {
    return this.refDataService.listLegalEntities();
  }

  @Post('legal-entities')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new legal entity' })
  createLegalEntity(
    @Body(new ZodValidationPipe(createLegalEntitySchema)) dto: CreateLegalEntityDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<LegalEntityAdminRow> {
    return this.refDataService.createLegalEntity(dto, admin.id);
  }

  @Patch('legal-entities/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a legal entity' })
  updateLegalEntity(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLegalEntitySchema)) dto: UpdateLegalEntityDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<LegalEntityAdminRow> {
    return this.refDataService.updateLegalEntity(id, dto, admin.id);
  }

  @Patch('legal-entities/:id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a legal entity' })
  deactivateLegalEntity(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.deactivateLegalEntity(id, admin.id);
  }

  @Patch('legal-entities/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a legal entity' })
  activateLegalEntity(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.activateLegalEntity(id, admin.id);
  }

  // ── Areas ─────────────────────────────────────────────────────────

  @Get('areas')
  @ApiOperation({ summary: 'List all areas (active + inactive)' })
  listAreas(): Promise<AreaAdminRow[]> {
    return this.refDataService.listAreas();
  }

  @Post('areas')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new area' })
  createArea(
    @Body(new ZodValidationPipe(createAreaSchema)) dto: CreateAreaDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<AreaAdminRow> {
    return this.refDataService.createArea(dto, admin.id);
  }

  @Patch('areas/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update an area' })
  updateArea(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAreaSchema)) dto: UpdateAreaDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<AreaAdminRow> {
    return this.refDataService.updateArea(id, dto, admin.id);
  }

  @Patch('areas/:id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate an area' })
  deactivateArea(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.deactivateArea(id, admin.id);
  }

  @Patch('areas/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate an area' })
  activateArea(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.activateArea(id, admin.id);
  }

  // ── Countries ─────────────────────────────────────────────────────

  @Get('countries')
  @ApiOperation({ summary: 'List all countries (active + inactive)' })
  listCountries(): Promise<CountryAdminRow[]> {
    return this.refDataService.listCountries();
  }

  @Post('countries')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new country' })
  createCountry(
    @Body(new ZodValidationPipe(createCountrySchema)) dto: CreateCountryDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<CountryAdminRow> {
    return this.refDataService.createCountry(dto, admin.id);
  }

  @Patch('countries/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a country' })
  updateCountry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCountrySchema)) dto: UpdateCountryDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<CountryAdminRow> {
    return this.refDataService.updateCountry(id, dto, admin.id);
  }

  @Patch('countries/:id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a country (blocked if in-flight demands exist)' })
  deactivateCountry(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.deactivateCountry(id, admin.id);
  }

  @Patch('countries/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a country' })
  activateCountry(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.refDataService.activateCountry(id, admin.id);
  }
}
