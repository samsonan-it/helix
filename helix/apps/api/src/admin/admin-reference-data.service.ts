import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CostCentreAdminRow,
  CreateCostCentreDto,
  UpdateCostCentreDto,
  GlAccountAdminRow,
  CreateGlAccountDto,
  UpdateGlAccountDto,
  LegalEntityAdminRow,
  CreateLegalEntityDto,
  UpdateLegalEntityDto,
  AreaAdminRow,
  CreateAreaDto,
  UpdateAreaDto,
  CountryAdminRow,
  CreateCountryDto,
  UpdateCountryDto,
} from '@helix/shared';

function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Injectable()
export class AdminReferenceDataService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cost Centres ──────────────────────────────────────────────────

  async listCostCentres(): Promise<CostCentreAdminRow[]> {
    const rows = await this.prisma.costCentre.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      updatedBy: r.updatedBy ?? null,
    }));
  }

  async createCostCentre(dto: CreateCostCentreDto, adminId: string): Promise<CostCentreAdminRow> {
    const existing = await this.prisma.costCentre.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('An entry with this code already exists');

    try {
      let result!: CostCentreAdminRow;
      await this.prisma.$transaction(async (tx) => {
        const cc = await tx.costCentre.create({ data: { ...dto, updatedBy: adminId } });
        result = {
          id: cc.id,
          code: cc.code,
          name: cc.name,
          isActive: cc.isActive,
          createdAt: cc.createdAt.toISOString(),
          updatedAt: cc.updatedAt?.toISOString() ?? null,
          updatedBy: cc.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'CostCentre',
            entityId: cc.id,
            eventType: 'COST_CENTRE_CREATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: null as never,
            after: { code: cc.code, name: cc.name } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async updateCostCentre(id: string, dto: UpdateCostCentreDto, adminId: string): Promise<CostCentreAdminRow> {
    const current = await this.prisma.costCentre.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Cost centre ${id} not found`);

    try {
      let result!: CostCentreAdminRow;
      await this.prisma.$transaction(async (tx) => {
        if (dto.code && dto.code !== current.code) {
          const taken = await tx.costCentre.findUnique({ where: { code: dto.code } });
          if (taken) throw new ConflictException('An entry with this code already exists');
        }
        const updated = await tx.costCentre.update({ where: { id }, data: { ...dto, updatedBy: adminId } });
        result = {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt?.toISOString() ?? null,
          updatedBy: updated.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'CostCentre',
            entityId: id,
            eventType: 'COST_CENTRE_UPDATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: { code: current.code, name: current.name } as never,
            after: { code: updated.code, name: updated.name } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async deactivateCostCentre(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.costCentre.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Cost centre ${id} not found`);
    if (!current.isActive) return;

    const blockers = await this.prisma.demand.findMany({
      where: { costCentreId: id, status: { notIn: ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'] } },
      select: { id: true, title: true, status: true },
    });
    if (blockers.length > 0) throw new UnprocessableEntityException({ blockers });

    await this.prisma.$transaction(async (tx) => {
      await tx.costCentre.update({ where: { id }, data: { isActive: false, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'CostCentre',
          entityId: id,
          eventType: 'COST_CENTRE_DEACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: false } as never,
        },
      });
    });
  }

  async activateCostCentre(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.costCentre.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Cost centre ${id} not found`);
    if (current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.costCentre.update({ where: { id }, data: { isActive: true, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'CostCentre',
          entityId: id,
          eventType: 'COST_CENTRE_ACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: true } as never,
        },
      });
    });
  }

  // ── GL Accounts ───────────────────────────────────────────────────

  async listGlAccounts(): Promise<GlAccountAdminRow[]> {
    const rows = await this.prisma.glAccount.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description ?? null,
      categories: r.categories as GlAccountAdminRow['categories'],
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      updatedBy: r.updatedBy ?? null,
    }));
  }

  async createGlAccount(dto: CreateGlAccountDto, adminId: string): Promise<GlAccountAdminRow> {
    const existing = await this.prisma.glAccount.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('An entry with this code already exists');

    try {
      let result!: GlAccountAdminRow;
      await this.prisma.$transaction(async (tx) => {
        const gl = await tx.glAccount.create({ data: { ...dto, updatedBy: adminId } });
        result = {
          id: gl.id,
          code: gl.code,
          name: gl.name,
          description: gl.description ?? null,
          categories: gl.categories as GlAccountAdminRow['categories'],
          isActive: gl.isActive,
          createdAt: gl.createdAt.toISOString(),
          updatedAt: gl.updatedAt?.toISOString() ?? null,
          updatedBy: gl.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'GlAccount',
            entityId: gl.id,
            eventType: 'GL_ACCOUNT_CREATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: null as never,
            after: { code: gl.code, name: gl.name, description: gl.description ?? null, categories: gl.categories } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async updateGlAccount(id: string, dto: UpdateGlAccountDto, adminId: string): Promise<GlAccountAdminRow> {
    const current = await this.prisma.glAccount.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`GL account ${id} not found`);

    try {
      let result!: GlAccountAdminRow;
      await this.prisma.$transaction(async (tx) => {
        if (dto.code && dto.code !== current.code) {
          const taken = await tx.glAccount.findUnique({ where: { code: dto.code } });
          if (taken) throw new ConflictException('An entry with this code already exists');
        }
        const updated = await tx.glAccount.update({ where: { id }, data: { ...dto, updatedBy: adminId } });
        result = {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          description: updated.description ?? null,
          categories: updated.categories as GlAccountAdminRow['categories'],
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt?.toISOString() ?? null,
          updatedBy: updated.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'GlAccount',
            entityId: id,
            eventType: 'GL_ACCOUNT_UPDATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: { code: current.code, name: current.name, description: current.description ?? null, categories: current.categories } as never,
            after: { code: updated.code, name: updated.name, description: updated.description ?? null, categories: updated.categories } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async deactivateGlAccount(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.glAccount.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`GL account ${id} not found`);
    if (!current.isActive) return;

    const blockers = await this.prisma.demand.findMany({
      where: { glAccountId: id, status: { notIn: ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'] } },
      select: { id: true, title: true, status: true },
    });
    if (blockers.length > 0) throw new UnprocessableEntityException({ blockers });

    await this.prisma.$transaction(async (tx) => {
      await tx.glAccount.update({ where: { id }, data: { isActive: false, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'GlAccount',
          entityId: id,
          eventType: 'GL_ACCOUNT_DEACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: false } as never,
        },
      });
    });
  }

  async activateGlAccount(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.glAccount.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`GL account ${id} not found`);
    if (current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.glAccount.update({ where: { id }, data: { isActive: true, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'GlAccount',
          entityId: id,
          eventType: 'GL_ACCOUNT_ACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: true } as never,
        },
      });
    });
  }

  // ── Legal Entities ────────────────────────────────────────────────

  async listLegalEntities(): Promise<LegalEntityAdminRow[]> {
    const rows = await this.prisma.legalEntity.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      country: r.country,
      mandatoryTimesheeting: r.mandatoryTimesheeting,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      updatedBy: r.updatedBy ?? null,
    }));
  }

  async createLegalEntity(dto: CreateLegalEntityDto, adminId: string): Promise<LegalEntityAdminRow> {
    try {
      let result!: LegalEntityAdminRow;
      await this.prisma.$transaction(async (tx) => {
        const le = await tx.legalEntity.create({ data: { ...dto, updatedBy: adminId } });
        result = {
          id: le.id,
          code: le.code,
          name: le.name,
          country: le.country,
          mandatoryTimesheeting: le.mandatoryTimesheeting,
          isActive: le.isActive,
          createdAt: le.createdAt.toISOString(),
          updatedAt: le.updatedAt?.toISOString() ?? null,
          updatedBy: le.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'LegalEntity',
            entityId: le.id,
            eventType: 'LEGAL_ENTITY_CREATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: null as never,
            after: { code: le.code, name: le.name, country: le.country, mandatoryTimesheeting: le.mandatoryTimesheeting } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async updateLegalEntity(id: string, dto: UpdateLegalEntityDto, adminId: string): Promise<LegalEntityAdminRow> {
    const current = await this.prisma.legalEntity.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Legal entity ${id} not found`);

    try {
      let result!: LegalEntityAdminRow;
      await this.prisma.$transaction(async (tx) => {
        if (dto.code && dto.code !== current.code) {
          const taken = await tx.legalEntity.findUnique({ where: { code: dto.code } });
          if (taken) throw new ConflictException('An entry with this code already exists');
        }
        const updated = await tx.legalEntity.update({ where: { id }, data: { ...dto, updatedBy: adminId } });
        result = {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          country: updated.country,
          mandatoryTimesheeting: updated.mandatoryTimesheeting,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt?.toISOString() ?? null,
          updatedBy: updated.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'LegalEntity',
            entityId: id,
            eventType: 'LEGAL_ENTITY_UPDATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: { code: current.code, name: current.name, country: current.country, mandatoryTimesheeting: current.mandatoryTimesheeting } as never,
            after: { code: updated.code, name: updated.name, country: updated.country, mandatoryTimesheeting: updated.mandatoryTimesheeting } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async deactivateLegalEntity(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.legalEntity.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Legal entity ${id} not found`);
    if (!current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      const blockers = await tx.demand.findMany({
        where: { legalEntityId: id, status: { notIn: ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'] } },
        select: { id: true, title: true, status: true },
      });
      if (blockers.length > 0) throw new UnprocessableEntityException({ blockers });
      await tx.legalEntity.update({ where: { id }, data: { isActive: false, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'LegalEntity',
          entityId: id,
          eventType: 'LEGAL_ENTITY_DEACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: false } as never,
        },
      });
    });
  }

  async activateLegalEntity(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.legalEntity.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Legal entity ${id} not found`);
    if (current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.legalEntity.update({ where: { id }, data: { isActive: true, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'LegalEntity',
          entityId: id,
          eventType: 'LEGAL_ENTITY_ACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: true } as never,
        },
      });
    });
  }

  // ── Areas ─────────────────────────────────────────────────────────

  async listAreas(): Promise<AreaAdminRow[]> {
    const rows = await this.prisma.smallProjectArea.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      updatedBy: r.updatedBy ?? null,
    }));
  }

  async createArea(dto: CreateAreaDto, adminId: string): Promise<AreaAdminRow> {
    try {
      let result!: AreaAdminRow;
      await this.prisma.$transaction(async (tx) => {
        const area = await tx.smallProjectArea.create({ data: { ...dto, updatedBy: adminId } });
        result = {
          id: area.id,
          code: area.code,
          name: area.name,
          isActive: area.isActive,
          createdAt: area.createdAt.toISOString(),
          updatedAt: area.updatedAt?.toISOString() ?? null,
          updatedBy: area.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'Area',
            entityId: area.id,
            eventType: 'AREA_CREATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: null as never,
            after: { code: area.code, name: area.name } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async updateArea(id: string, dto: UpdateAreaDto, adminId: string): Promise<AreaAdminRow> {
    const current = await this.prisma.smallProjectArea.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Area ${id} not found`);

    try {
      let result!: AreaAdminRow;
      await this.prisma.$transaction(async (tx) => {
        if (dto.code && dto.code !== current.code) {
          const taken = await tx.smallProjectArea.findUnique({ where: { code: dto.code } });
          if (taken) throw new ConflictException('An entry with this code already exists');
        }
        const updated = await tx.smallProjectArea.update({ where: { id }, data: { ...dto, updatedBy: adminId } });
        result = {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt?.toISOString() ?? null,
          updatedBy: updated.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'Area',
            entityId: id,
            eventType: 'AREA_UPDATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: { code: current.code, name: current.name } as never,
            after: { code: updated.code, name: updated.name } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async deactivateArea(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.smallProjectArea.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Area ${id} not found`);
    if (!current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      const blockers = await tx.demand.findMany({
        where: { areaId: id, status: { notIn: ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'] } },
        select: { id: true, title: true, status: true },
      });
      if (blockers.length > 0) throw new UnprocessableEntityException({ blockers });
      await tx.smallProjectArea.update({ where: { id }, data: { isActive: false, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'Area',
          entityId: id,
          eventType: 'AREA_DEACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: false } as never,
        },
      });
    });
  }

  async activateArea(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.smallProjectArea.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Area ${id} not found`);
    if (current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.smallProjectArea.update({ where: { id }, data: { isActive: true, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'Area',
          entityId: id,
          eventType: 'AREA_ACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: true } as never,
        },
      });
    });
  }

  // ── Countries ─────────────────────────────────────────────────────

  async listCountries(): Promise<CountryAdminRow[]> {
    const rows = await this.prisma.country.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      updatedBy: r.updatedBy ?? null,
    }));
  }

  async createCountry(dto: CreateCountryDto, adminId: string): Promise<CountryAdminRow> {
    try {
      let result!: CountryAdminRow;
      await this.prisma.$transaction(async (tx) => {
        const country = await tx.country.create({ data: { ...dto, updatedBy: adminId } });
        result = {
          id: country.id,
          code: country.code,
          name: country.name,
          isActive: country.isActive,
          createdAt: country.createdAt.toISOString(),
          updatedAt: country.updatedAt?.toISOString() ?? null,
          updatedBy: country.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'Country',
            entityId: country.id,
            eventType: 'COUNTRY_CREATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: null as never,
            after: { code: country.code, name: country.name } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async updateCountry(id: string, dto: UpdateCountryDto, adminId: string): Promise<CountryAdminRow> {
    const current = await this.prisma.country.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Country ${id} not found`);

    try {
      let result!: CountryAdminRow;
      await this.prisma.$transaction(async (tx) => {
        if (dto.code && dto.code !== current.code) {
          const taken = await tx.country.findUnique({ where: { code: dto.code } });
          if (taken) throw new ConflictException('An entry with this code already exists');
        }
        const updated = await tx.country.update({ where: { id }, data: { ...dto, updatedBy: adminId } });
        result = {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt?.toISOString() ?? null,
          updatedBy: updated.updatedBy ?? null,
        };
        await tx.auditLog.create({
          data: {
            entityType: 'Country',
            entityId: id,
            eventType: 'COUNTRY_UPDATED',
            changedBy: adminId,
            changedAt: new Date(),
            before: { code: current.code, name: current.name } as never,
            after: { code: updated.code, name: updated.name } as never,
          },
        });
      });
      return result;
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException('An entry with this code already exists');
      throw e;
    }
  }

  async deactivateCountry(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.country.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Country ${id} not found`);
    if (!current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      const blockers = await tx.demand.findMany({
        where: { countryId: id, status: { notIn: ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'] } },
        select: { id: true, title: true, status: true },
      });
      if (blockers.length > 0) throw new UnprocessableEntityException({ blockers });
      await tx.country.update({ where: { id }, data: { isActive: false, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'Country',
          entityId: id,
          eventType: 'COUNTRY_DEACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: false } as never,
        },
      });
    });
  }

  async activateCountry(id: string, adminId: string): Promise<void> {
    const current = await this.prisma.country.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Country ${id} not found`);
    if (current.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.country.update({ where: { id }, data: { isActive: true, updatedBy: adminId } });
      await tx.auditLog.create({
        data: {
          entityType: 'Country',
          entityId: id,
          eventType: 'COUNTRY_ACTIVATED',
          changedBy: adminId,
          changedAt: new Date(),
          before: { isActive: current.isActive } as never,
          after: { isActive: true } as never,
        },
      });
    });
  }
}
