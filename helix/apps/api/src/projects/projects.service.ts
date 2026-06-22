import * as path from 'path';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDetail, ProjectItem, ProjectListFilters, ProjectListResponse, ProjectPlanItemResponse, ProjectPlanResponse } from './projects.types';
import { ClosureSubmitDto, ProjectHistoryItem, ReplaceProjectPlanDto, UpdateCharterDto, UpdateInternalOrdersDto, updateInternalOrdersSchema, submitCharterValidationSchema } from '@helix/shared';
import { withProjectLock } from '../common/utils/pessimistic-lock.util';
import {
  PROJECT_EVENTS,
  ProjectCharterApprovedEvent,
  ProjectCharterReturnedEvent,
  ProjectCharterSubmittedEvent,
  ProjectClosureAcceptedEvent,
  ProjectClosureReturnedEvent,
  ProjectClosureSubmittedEvent,
} from './project-staleness.service';
import { Role } from '@helix/types';
import { FILE_STORAGE_SERVICE, IFileStorageService } from '../common/file-storage/file-storage.interface';

const INACTIVE_STATUSES = ['COMPLETED', 'CANCELLED'];

type ProjectStage = 'Initiation' | 'Implementation' | 'Testing' | 'Go-Live' | 'Hypercare' | 'Closure';

// Used for list queries (no charter fields)
type ProjectWithDemand = Prisma.ProjectGetPayload<{
  select: {
    id: true;
    demandId: true;
    status: true;
    currentStage: true;
    assignedPmId: true;
    createdAt: true;
    closureSubmittedAt: true;
    demand: {
      select: {
        id: true;
        publicId: true;
        title: true;
        isSmallProject: true;
        startDate: true;
        endDate: true;
        description: true;
        asisDescription: true;
        tobeDescription: true;
        projectType: true;
        investmentApproval: true;
        demandScope: true;
      };
    };
    assignedPm: { select: { name: true } };
    statusReports: { select: { overallRag: true } };
  };
}>;

// Used for detail queries (includes all 25 charter fields)
type ProjectDetailRaw = Prisma.ProjectGetPayload<{
  select: {
    id: true;
    demandId: true;
    status: true;
    currentStage: true;
    assignedPmId: true;
    createdAt: true;
    objective: true;
    necessity: true;
    gxpRelevant: true;
    eaInvolved: true;
    eaComment: true;
    itSecurityInvolved: true;
    itSecurityComment: true;
    scope: true;
    depsAssumptionsRisk: true;
    appPlatformOwner: true;
    businessPm: true;
    businessSponsor: true;
    icRecharge: true;
    icRechargeAlignmentConducted: true;
    archImpact: true;
    eaAlignmentConducted: true;
    itSecurityAlignmentConducted: true;
    maintenanceL1: true;
    maintenanceL2: true;
    maintenanceL3: true;
    licensesNeeded: true;
    licenseCostCents: true;
    licenseExpectedUsers: true;
    licenseMetric: true;
    licenseInBudget: true;
    qualitativeValue: true;
    quantitativeValue: true;
    valueCaseDescription: true;
    charterSubmittedAt: true;
    closureWorkDelivered: true;
    closureFinancialReconciled: true;
    closureHandoverDocumentPath: true;
    closurePmSummaryNotes: true;
    closureSubmittedAt: true;
    opexInternalOrder: true;
    capexInternalOrder: true;
    demand: {
      select: {
        id: true;
        publicId: true;
        title: true;
        isSmallProject: true;
        startDate: true;
        endDate: true;
        description: true;
        asisDescription: true;
        tobeDescription: true;
        projectType: true;
        investmentApproval: true;
        demandScope: true;
        demandManagerId: true;
      };
    };
    assignedPm: { select: { name: true } };
    statusReports: { select: { overallRag: true } };
  };
}>;

const DETAIL_SELECT = {
  id: true,
  demandId: true,
  status: true,
  currentStage: true,
  assignedPmId: true,
  createdAt: true,
  objective: true,
  necessity: true,
  gxpRelevant: true,
  eaInvolved: true,
  eaComment: true,
  itSecurityInvolved: true,
  itSecurityComment: true,
  scope: true,
  depsAssumptionsRisk: true,
  appPlatformOwner: true,
  businessPm: true,
  businessSponsor: true,
  icRecharge: true,
  icRechargeAlignmentConducted: true,
  archImpact: true,
  eaAlignmentConducted: true,
  itSecurityAlignmentConducted: true,
  maintenanceL1: true,
  maintenanceL2: true,
  maintenanceL3: true,
  licensesNeeded: true,
  licenseCostCents: true,
  licenseExpectedUsers: true,
  licenseMetric: true,
  licenseInBudget: true,
  qualitativeValue: true,
  quantitativeValue: true,
  valueCaseDescription: true,
  charterSubmittedAt: true,
  closureWorkDelivered: true,
  closureFinancialReconciled: true,
  closureHandoverDocumentPath: true,
  closurePmSummaryNotes: true,
  closureSubmittedAt: true,
  opexInternalOrder: true,
  capexInternalOrder: true,
  demand: {
    select: {
      id: true,
      publicId: true,
      title: true,
      isSmallProject: true,
      startDate: true,
      endDate: true,
      description: true,
      asisDescription: true,
      tobeDescription: true,
      projectType: true,
      investmentApproval: true,
      demandScope: true,
      demandManagerId: true,
    },
  },
  assignedPm: { select: { name: true } },
  statusReports: { orderBy: { submittedAt: 'desc' as const }, take: 1, select: { overallRag: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorage: IFileStorageService,
  ) {}

  async getProjectList(userId: string, filters: ProjectListFilters): Promise<ProjectListResponse> {
    const page = Math.max(1, filters.page);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize));
    const skip = (page - 1) * pageSize;

    const statusFilter: Prisma.ProjectWhereInput = filters.status
      ? { status: filters.status as never }
      : { status: { notIn: INACTIVE_STATUSES as never[] } };

    const isPpmOrAdmin = filters.userRoles.includes('PortfolioManager') || filters.userRoles.includes('Admin');

    const where: Prisma.ProjectWhereInput = {
      ...(isPpmOrAdmin ? {} : { assignedPmId: userId }),
      ...statusFilter,
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { demand: { title: 'asc' } },
        skip,
        take: pageSize,
        select: {
          id: true,
          demandId: true,
          status: true,
          currentStage: true,
          assignedPmId: true,
          createdAt: true,
          closureSubmittedAt: true,
          demand: {
            select: {
              id: true,
              publicId: true,
              title: true,
              isSmallProject: true,
              startDate: true,
              endDate: true,
              description: true,
              asisDescription: true,
              tobeDescription: true,
              projectType: true,
              investmentApproval: true,
              demandScope: true,
            },
          },
          assignedPm: { select: { name: true } },
          statusReports: { orderBy: { submittedAt: 'desc' }, take: 1, select: { overallRag: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map((p) => this.mapToItem(p)),
      total,
      page,
      pageSize,
    };
  }

  async getProject(projectId: string, userId: string, userRoles: Role[]): Promise<ProjectDetail> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: DETAIL_SELECT,
    });

    const isPpmOrAdmin = userRoles.includes(Role.PortfolioManager) || userRoles.includes(Role.Admin);
    const isDm = project?.demand?.isSmallProject && project?.demand?.demandManagerId === userId;
    const canView = project?.assignedPmId === userId || isDm || isPpmOrAdmin;

    if (!project || !canView) {
      throw new NotFoundException('Project not found');
    }

    return this.mapToDetailWithCharter(project);
  }

  async updateCurrentStage(projectId: string, userId: string, userRoles: Role[], stage: ProjectStage, comment?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { assignedPmId: true, status: true, currentStage: true, demand: { select: { isSmallProject: true, demandManagerId: true } } },
      });
      const isPpmOrAdmin = userRoles.includes(Role.PortfolioManager) || userRoles.includes(Role.Admin);
      const canAct = isPpmOrAdmin || project?.assignedPmId === userId || (project?.demand?.isSmallProject && project?.demand?.demandManagerId === userId);
      if (!project || !canAct) throw new NotFoundException('Project not found');
      if (project.status !== 'IN_EXECUTION') throw new BadRequestException('Stage can only be set on IN_EXECUTION projects');

      const isClosure = stage === 'Closure';
      const newStatus = isClosure ? 'PREPARE_FOR_CLOSURE' : project.status;

      await tx.project.update({
        where: { id: projectId },
        data: { currentStage: stage, ...(isClosure ? { status: 'PREPARE_FOR_CLOSURE' } : {}) },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: projectId,
          eventType: isClosure ? 'PROJECT_CLOSURE_INITIATED' : 'PROJECT_STAGE_UPDATED',
          changedBy: userId,
          before: { currentStage: project.currentStage, status: project.status },
          after: { currentStage: stage, status: newStatus, ...(comment ? { comment } : {}) },
        },
      });
    });
  }

  async updateCharter(projectId: string, userId: string, userRoles: Role[], dto: UpdateCharterDto): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { assignedPmId: true, status: true },
      });
      if (!project) throw new NotFoundException('Project not found');

      const isAssignedPm = project.assignedPmId === userId;
      const isPpmOrAdmin = userRoles.includes(Role.PortfolioManager) || userRoles.includes(Role.Admin);

      if (!isAssignedPm && !isPpmOrAdmin) {
        throw new ForbiddenException('Access denied');
      }
      // PENDING_APPROVAL: only PPM/Admin may edit (checked inside tx to prevent TOCTOU race)
      if (project.status === 'PENDING_APPROVAL' && isAssignedPm && !isPpmOrAdmin) {
        throw new ForbiddenException('Charter cannot be edited while awaiting approval');
      }

      await tx.project.update({ where: { id: projectId }, data: dto });
      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: projectId,
          eventType: 'PROJECT_CHARTER_UPDATED',
          changedBy: userId,
          before: Prisma.JsonNull,
          after: dto as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async submitCharter(projectId: string, userId: string): Promise<void> {
    await withProjectLock(this.prisma, projectId, async (locked, tx) => {
      const project = await tx.project.findUniqueOrThrow({ where: { id: locked.id } });

      if (project.assignedPmId !== userId) {
        throw new ForbiddenException('Only the assigned PM can submit the charter');
      }
      if (project.status !== 'DRAFT') {
        throw new BadRequestException('Charter can only be submitted from DRAFT status');
      }

      const projectForValidation = {
        ...project,
        eaComment: project.eaComment?.trim() || null,
        itSecurityComment: project.itSecurityComment?.trim() || null,
      };
      const validation = submitCharterValidationSchema.safeParse(projectForValidation);
      if (!validation.success) {
        throw new BadRequestException({ message: 'Charter validation failed', errors: validation.error.flatten().fieldErrors });
      }

      await tx.project.update({
        where: { id: locked.id },
        data: {
          status: 'PENDING_APPROVAL',
          charterSubmittedAt: new Date(),
          eaComment: projectForValidation.eaComment,
          itSecurityComment: projectForValidation.itSecurityComment,
        },
      });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: locked.id,
          eventType: 'PROJECT_CHARTER_SUBMITTED',
          changedBy: userId,
          before: { status: 'DRAFT' },
          after: { status: 'PENDING_APPROVAL' },
        },
      });
    });

    // Emit after transaction commits
    const projectWithTitle = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { demand: { select: { title: true } } },
    });
    const title = projectWithTitle?.demand?.title ?? '';
    this.eventEmitter.emit(
      PROJECT_EVENTS.CHARTER_SUBMITTED,
      new ProjectCharterSubmittedEvent(projectId, userId, title),
    );
  }

  async approveCharter(projectId: string, userId: string, userRoles: string[]): Promise<void> {
    if (!userRoles.includes('PortfolioManager') && !userRoles.includes('Admin')) {
      throw new ForbiddenException('Charter approval requires Portfolio Manager or Admin role');
    }
    let title = '';
    let assignedPmId: string | null = null;
    await withProjectLock(this.prisma, projectId, async (locked, tx) => {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: locked.id },
        select: { status: true, assignedPmId: true, demand: { select: { title: true } } },
      });
      if (project.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(`Cannot approve charter: project is ${project.status}`);
      }
      if (project.assignedPmId && project.assignedPmId === userId) {
        throw new ForbiddenException('Cannot approve your own charter');
      }
      title = project.demand.title;
      assignedPmId = project.assignedPmId;
      await tx.project.update({
        where: { id: locked.id },
        data: { status: 'IN_EXECUTION', currentStage: 'Initiation' },
      });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project', entityId: locked.id,
          eventType: 'CHARTER_APPROVED', changedBy: userId,
          before: { status: 'PENDING_APPROVAL' },
          after: { status: 'IN_EXECUTION', currentStage: 'Initiation' },
        },
      });
    });
    this.eventEmitter.emit(
      PROJECT_EVENTS.CHARTER_APPROVED,
      new ProjectCharterApprovedEvent(projectId, userId, title, assignedPmId),
    );
  }

  async returnCharter(projectId: string, userId: string, userRoles: string[], comment: string): Promise<void> {
    if (!userRoles.includes('PortfolioManager') && !userRoles.includes('Admin')) {
      throw new ForbiddenException('Charter return requires Portfolio Manager or Admin role');
    }
    if (!comment?.trim()) throw new BadRequestException('Return comment is required');
    let title = '';
    let assignedPmId: string | null = null;
    await withProjectLock(this.prisma, projectId, async (locked, tx) => {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: locked.id },
        select: { status: true, assignedPmId: true, demand: { select: { title: true } } },
      });
      if (project.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(`Cannot return charter: project is ${project.status}`);
      }
      if (project.assignedPmId && project.assignedPmId === userId) {
        throw new ForbiddenException('Cannot return your own charter');
      }
      title = project.demand.title;
      assignedPmId = project.assignedPmId;
      await tx.project.update({
        where: { id: locked.id },
        data: { status: 'DRAFT' },
      });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project', entityId: locked.id,
          eventType: 'CHARTER_RETURNED', changedBy: userId,
          before: { status: 'PENDING_APPROVAL' },
          after: { status: 'DRAFT', returnComment: comment.trim() },
        },
      });
    });
    this.eventEmitter.emit(
      PROJECT_EVENTS.CHARTER_RETURNED,
      new ProjectCharterReturnedEvent(projectId, userId, title, assignedPmId, comment.trim()),
    );
  }

  async getCharterQueue(userId: string, userRoles: string[]): Promise<ProjectItem[]> {
    if (!userRoles.includes('PortfolioManager') && !userRoles.includes('Admin')) {
      throw new ForbiddenException('Charter queue requires Portfolio Manager or Admin role');
    }
    const projects = await this.prisma.project.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { charterSubmittedAt: 'asc' },
      select: {
        id: true,
        demandId: true,
        status: true,
        currentStage: true,
        assignedPmId: true,
        createdAt: true,
        charterSubmittedAt: true,
        closureSubmittedAt: true,
        demand: {
          select: {
            id: true,
            publicId: true,
            title: true,
            isSmallProject: true,
            startDate: true,
            endDate: true,
            description: true,
            asisDescription: true,
            tobeDescription: true,
            projectType: true,
            investmentApproval: true,
            demandScope: true,
          },
        },
        assignedPm: { select: { name: true } },
        statusReports: { orderBy: { submittedAt: 'desc' }, take: 1, select: { overallRag: true } },
      },
    });
    return projects.map((p) => ({
      ...this.mapToItem(p),
      charterSubmittedAt: p.charterSubmittedAt?.toISOString() ?? null,
    }));
  }

  private assertClosureActor(
    project: { assignedPmId: string | null; demand: { isSmallProject: boolean; demandManagerId: string | null } | null },
    userId: string,
    userRoles: Role[],
  ): void {
    const isPpmOrAdmin = userRoles.includes(Role.PortfolioManager) || userRoles.includes(Role.Admin);
    const isAssignedPm = project.assignedPmId === userId;
    const isDm = project.demand?.isSmallProject && project.demand.demandManagerId === userId;
    if (!isAssignedPm && !isDm && !isPpmOrAdmin) {
      throw new ForbiddenException('Access denied');
    }
  }

  async uploadHandoverDocument(
    projectId: string,
    userId: string,
    userRoles: Role[],
    file: Express.Multer.File,
  ): Promise<{ fileName: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        assignedPmId: true,
        status: true,
        closureSubmittedAt: true,
        closureHandoverDocumentPath: true,
        demand: { select: { isSmallProject: true, demandManagerId: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    this.assertClosureActor(project, userId, userRoles);
    if (project.status !== 'PREPARE_FOR_CLOSURE') throw new BadRequestException('Project is not in PREPARE_FOR_CLOSURE status');
    if (project.closureSubmittedAt) throw new BadRequestException('Closure already submitted');

    if (project.closureHandoverDocumentPath) {
      await this.fileStorage.delete(project.closureHandoverDocumentPath);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const key = `handover-docs/${projectId}-${Date.now()}${ext}`;
    const storedKey = await this.fileStorage.upload(key, file.buffer, file.mimetype);

    try {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { closureHandoverDocumentPath: storedKey },
      });
    } catch (err) {
      await this.fileStorage.delete(storedKey).catch(() => {});
      throw err;
    }
    return { fileName: file.originalname };
  }

  async submitClosure(
    projectId: string,
    userId: string,
    userRoles: Role[],
    dto: ClosureSubmitDto,
  ): Promise<void> {
    await withProjectLock(this.prisma, projectId, async (locked, tx) => {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: locked.id },
        select: {
          assignedPmId: true,
          status: true,
          closureSubmittedAt: true,
          closureHandoverDocumentPath: true,
          demand: { select: { isSmallProject: true, demandManagerId: true } },
        },
      });
      this.assertClosureActor(project, userId, userRoles);
      if (project.status !== 'PREPARE_FOR_CLOSURE') throw new BadRequestException('Project is not in PREPARE_FOR_CLOSURE status');
      if (project.closureSubmittedAt) throw new BadRequestException('Closure already submitted');
      if (!project.closureHandoverDocumentPath) throw new BadRequestException('Handover document must be uploaded before submitting');
      if (!dto.workDelivered || !dto.financialReconciled) throw new BadRequestException('Both mandatory confirmations are required');

      const now = new Date();
      await tx.project.update({
        where: { id: locked.id },
        data: {
          closureWorkDelivered: true,
          closureFinancialReconciled: true,
          closurePmSummaryNotes: dto.pmSummaryNotes ?? null,
          closureSubmittedAt: now,
        },
      });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: locked.id,
          eventType: 'PROJECT_CLOSURE_SUBMITTED',
          changedBy: userId,
          before: { closureSubmittedAt: null },
          after: { closureSubmittedAt: now.toISOString() },
        },
      });
    });

    this.eventEmitter.emit(PROJECT_EVENTS.CLOSURE_SUBMITTED, new ProjectClosureSubmittedEvent(projectId, userId));
  }

  async acceptClosure(projectId: string, userId: string, userRoles: Role[]): Promise<void> {
    if (!userRoles.includes(Role.PortfolioManager) && !userRoles.includes(Role.Admin)) {
      throw new ForbiddenException('Closure acceptance requires Portfolio Manager or Admin role');
    }
    let title = '';
    let assignedPmId: string | null = null;
    await withProjectLock(this.prisma, projectId, async (locked, tx) => {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: locked.id },
        select: { status: true, assignedPmId: true, demand: { select: { title: true } } },
      });
      if (project.status !== 'PREPARE_FOR_CLOSURE') {
        throw new BadRequestException(`Cannot accept closure: project is ${project.status}`);
      }
      title = project.demand.title;
      assignedPmId = project.assignedPmId;
      await tx.project.update({ where: { id: locked.id }, data: { status: 'COMPLETED' } });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project', entityId: locked.id,
          eventType: 'CLOSURE_ACCEPTED', changedBy: userId,
          before: { status: 'PREPARE_FOR_CLOSURE' },
          after: { status: 'COMPLETED' },
        },
      });
    });
    this.eventEmitter.emit(
      PROJECT_EVENTS.CLOSURE_ACCEPTED,
      new ProjectClosureAcceptedEvent(projectId, userId, title, assignedPmId),
    );
  }

  async returnClosure(projectId: string, userId: string, userRoles: Role[], comment: string): Promise<void> {
    if (!userRoles.includes(Role.PortfolioManager) && !userRoles.includes(Role.Admin)) {
      throw new ForbiddenException('Closure return requires Portfolio Manager or Admin role');
    }
    if (!comment?.trim()) throw new BadRequestException('Return comment is required');
    let title = '';
    let assignedPmId: string | null = null;
    await withProjectLock(this.prisma, projectId, async (locked, tx) => {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: locked.id },
        select: { status: true, assignedPmId: true, demand: { select: { title: true } } },
      });
      if (project.status !== 'PREPARE_FOR_CLOSURE') {
        throw new BadRequestException(`Cannot return closure: project is ${project.status}`);
      }
      title = project.demand.title;
      assignedPmId = project.assignedPmId;
      await tx.project.update({
        where: { id: locked.id },
        data: { status: 'IN_EXECUTION', closureSubmittedAt: null },
      });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project', entityId: locked.id,
          eventType: 'CLOSURE_RETURNED', changedBy: userId,
          before: { status: 'PREPARE_FOR_CLOSURE' },
          after: { status: 'IN_EXECUTION', returnComment: comment.trim() },
        },
      });
    });
    this.eventEmitter.emit(
      PROJECT_EVENTS.CLOSURE_RETURNED,
      new ProjectClosureReturnedEvent(projectId, userId, title, assignedPmId, comment.trim()),
    );
  }

  async getClosureQueue(userId: string, userRoles: Role[]): Promise<ProjectItem[]> {
    if (!userRoles.includes(Role.PortfolioManager) && !userRoles.includes(Role.Admin)) {
      throw new ForbiddenException('Closure queue requires Portfolio Manager or Admin role');
    }
    const projects = await this.prisma.project.findMany({
      where: { status: 'PREPARE_FOR_CLOSURE' },
      orderBy: { closureSubmittedAt: 'asc' },
      select: {
        id: true,
        demandId: true,
        status: true,
        currentStage: true,
        assignedPmId: true,
        createdAt: true,
        closureSubmittedAt: true,
        demand: {
          select: {
            id: true,
            publicId: true,
            title: true,
            isSmallProject: true,
            startDate: true,
            endDate: true,
            description: true,
            asisDescription: true,
            tobeDescription: true,
            projectType: true,
            investmentApproval: true,
            demandScope: true,
          },
        },
        assignedPm: { select: { name: true } },
        statusReports: { orderBy: { submittedAt: 'desc' }, take: 1, select: { overallRag: true } },
      },
    });
    return projects.map((p) => this.mapToItem(p));
  }

  private mapToItem(p: ProjectWithDemand): ProjectItem {
    return {
      id: p.id,
      demandId: p.demandId,
      publicId: p.demand.publicId,
      title: p.demand.title,
      demandType: p.demand.isSmallProject ? 'SP' : 'P',
      startDate: p.demand.startDate?.toISOString() ?? null,
      endDate: p.demand.endDate?.toISOString() ?? null,
      overallRag: p.statusReports[0]?.overallRag ?? null,
      status: p.status,
      currentStage: p.currentStage,
      assignedPmId: p.assignedPmId,
      assignedPmName: p.assignedPm?.name ?? null,
      closureSubmittedAt: p.closureSubmittedAt?.toISOString() ?? null,
    };
  }

  private mapToDetailWithCharter(p: ProjectDetailRaw): ProjectDetail {
    return {
      id: p.id,
      demandId: p.demandId,
      title: p.demand.title,
      demandType: p.demand.isSmallProject ? 'SP' : 'P',
      startDate: p.demand.startDate?.toISOString() ?? null,
      endDate: p.demand.endDate?.toISOString() ?? null,
      overallRag: p.statusReports[0]?.overallRag ?? null,
      status: p.status,
      currentStage: p.currentStage,
      assignedPmId: p.assignedPmId,
      assignedPmName: p.assignedPm?.name ?? null,
      description: p.demand.description ?? null,
      businessCase: null,
      asIsDescription: p.demand.asisDescription ?? null,
      toBeDescription: p.demand.tobeDescription ?? null,
      projectType: p.demand.projectType ?? null,
      investmentApproval: p.demand.investmentApproval ?? null,
      demandScope: p.demand.demandScope ?? null,
      isSmallProject: p.demand.isSmallProject,
      publicId: p.demand.publicId,
      createdAt: p.createdAt.toISOString(),
      // Charter fields
      objective: p.objective,
      necessity: p.necessity,
      gxpRelevant: p.gxpRelevant,
      eaInvolved: p.eaInvolved,
      eaComment: p.eaComment,
      itSecurityInvolved: p.itSecurityInvolved,
      itSecurityComment: p.itSecurityComment,
      scope: p.scope,
      depsAssumptionsRisk: p.depsAssumptionsRisk,
      appPlatformOwner: p.appPlatformOwner,
      businessPm: p.businessPm,
      businessSponsor: p.businessSponsor,
      icRecharge: p.icRecharge,
      icRechargeAlignmentConducted: p.icRechargeAlignmentConducted,
      archImpact: p.archImpact,
      eaAlignmentConducted: p.eaAlignmentConducted,
      itSecurityAlignmentConducted: p.itSecurityAlignmentConducted,
      maintenanceL1: p.maintenanceL1,
      maintenanceL2: p.maintenanceL2,
      maintenanceL3: p.maintenanceL3,
      licensesNeeded: p.licensesNeeded,
      licenseCostCents: p.licenseCostCents,
      licenseExpectedUsers: p.licenseExpectedUsers,
      licenseMetric: p.licenseMetric,
      licenseInBudget: p.licenseInBudget,
      qualitativeValue: p.qualitativeValue,
      quantitativeValue: p.quantitativeValue,
      valueCaseDescription: p.valueCaseDescription,
      charterSubmittedAt: p.charterSubmittedAt?.toISOString() ?? null,
      closureWorkDelivered: p.closureWorkDelivered,
      closureFinancialReconciled: p.closureFinancialReconciled,
      closureHandoverDocumentPath: p.closureHandoverDocumentPath,
      closurePmSummaryNotes: p.closurePmSummaryNotes,
      closureSubmittedAt: p.closureSubmittedAt?.toISOString() ?? null,
      demandManagerId: p.demand.demandManagerId,
      opexInternalOrder: p.opexInternalOrder,
      capexInternalOrder: p.capexInternalOrder,
    };
  }

  async updateInternalOrders(projectId: string, userId: string, _userRoles: Role[], dto: UpdateInternalOrdersDto): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { opexInternalOrder: true, capexInternalOrder: true },
      });
      if (!project) throw new NotFoundException('Project not found');

      const before = { opexInternalOrder: project.opexInternalOrder, capexInternalOrder: project.capexInternalOrder };
      const after = { ...before, ...dto };
      await tx.project.update({ where: { id: projectId }, data: dto });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: projectId,
          eventType: 'PROJECT_INTERNAL_ORDER_UPDATED',
          changedBy: userId,
          before: before as Prisma.InputJsonValue,
          after: after as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async bulkImportInternalOrders(
    file: Express.Multer.File,
    overwrite: boolean,
    userId: string,
    _userRoles: Role[],
  ): Promise<{ imported: number; skipped: number; errors: { row: number; helix_project_id: string; reason: string }[] }> {
    // Plain CSV parse (3 columns, no quoting needed — see Dev Notes §CSV parsing)
    const lines = file.buffer.toString('utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const dataRows = lines.slice(1); // skip header

    type CsvRow = { row: number; projectId: string; opex: string | null; capex: string | null };
    const parsed: CsvRow[] = dataRows.map((line, i) => {
      const parts = line.split(',');
      return {
        row: i + 2,
        projectId: (parts[0] ?? '').trim(),
        opex: (parts[1] ?? '').trim() || null,
        capex: (parts[2] ?? '').trim() || null,
      };
    });

    const errors: { row: number; helix_project_id: string; reason: string }[] = [];

    const projectIds = parsed.map((r) => r.projectId).filter(Boolean);
    const existing = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, opexInternalOrder: true, capexInternalOrder: true },
    });
    const existingMap = new Map(existing.map((p) => [p.id, p]));

    const seenIds = new Set<string>();
    for (const row of parsed) {
      if (!row.projectId) {
        errors.push({ row: row.row, helix_project_id: row.projectId, reason: 'Missing helix_project_id' });
        continue;
      }
      if (seenIds.has(row.projectId)) {
        errors.push({ row: row.row, helix_project_id: row.projectId, reason: 'Duplicate helix_project_id in CSV' });
        continue;
      }
      seenIds.add(row.projectId);
      if (!existingMap.has(row.projectId)) {
        errors.push({ row: row.row, helix_project_id: row.projectId, reason: 'Project not found' });
        continue;
      }
      const proj = existingMap.get(row.projectId)!;
      if (!overwrite) {
        if (row.opex && proj.opexInternalOrder) {
          errors.push({ row: row.row, helix_project_id: row.projectId, reason: 'opexInternalOrder already set; send overwrite:true to replace' });
        }
        if (row.capex && proj.capexInternalOrder) {
          errors.push({ row: row.row, helix_project_id: row.projectId, reason: 'capexInternalOrder already set; send overwrite:true to replace' });
        }
      }
    }

    if (errors.length > 0) {
      throw new UnprocessableEntityException({ imported: 0, skipped: 0, errors });
    }

    let importedCount = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const row of parsed) {
        const proj = existingMap.get(row.projectId)!;
        const before = { opexInternalOrder: proj.opexInternalOrder, capexInternalOrder: proj.capexInternalOrder };
        const data: Record<string, string | null> = {};
        if (row.opex !== null) data['opexInternalOrder'] = row.opex;
        if (row.capex !== null) data['capexInternalOrder'] = row.capex;
        if (Object.keys(data).length === 0) continue;

        await tx.project.update({ where: { id: row.projectId }, data });
        // Rule 8: audit log last
        await tx.auditLog.create({
          data: {
            entityType: 'Project',
            entityId: row.projectId,
            eventType: 'PROJECT_INTERNAL_ORDER_UPDATED',
            changedBy: userId,
            before: before as Prisma.InputJsonValue,
            after: { ...before, ...data } as unknown as Prisma.InputJsonValue,
          },
        });
        importedCount++;
      }
    });

    return { imported: importedCount, skipped: parsed.length - importedCount, errors: [] };
  }

  async getProjectPlan(projectId: string, userId: string, userRoles: Role[]): Promise<ProjectPlanResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { assignedPmId: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const isAssignedPm = project.assignedPmId === userId;
    const isPpmOrAdmin = userRoles.includes(Role.PortfolioManager) || userRoles.includes(Role.Admin);

    if (!isAssignedPm && !isPpmOrAdmin) {
      throw new ForbiddenException('Access denied');
    }

    const items = await this.prisma.projectPlanItem.findMany({
      where: { projectId },
      orderBy: { displayOrder: 'asc' },
    });

    return {
      items: items.map((item): ProjectPlanItemResponse => ({
        id: item.id,
        name: item.name,
        type: item.type as 'PHASE' | 'MILESTONE',
        startDate: item.startDate.toISOString(),
        endDate: item.endDate?.toISOString() ?? null,
        displayOrder: item.displayOrder,
      })),
    };
  }

  async replaceProjectPlan(projectId: string, userId: string, userRoles: Role[], dto: ReplaceProjectPlanDto): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { assignedPmId: true, status: true },
      });

      if (!project) throw new NotFoundException('Project not found');

      const isAssignedPm = project.assignedPmId === userId;
      const isPpmOrAdmin = userRoles.includes(Role.PortfolioManager) || userRoles.includes(Role.Admin);

      if (!isAssignedPm && !isPpmOrAdmin) {
        throw new ForbiddenException('Access denied');
      }
      if (project.status === 'COMPLETED' || project.status === 'CANCELLED') {
        throw new BadRequestException('Cannot modify plan of a completed or cancelled project');
      }

      await tx.projectPlanItem.deleteMany({ where: { projectId } });
      await tx.projectPlanItem.createMany({
        data: dto.items.map((item, i) => ({
          projectId,
          name: item.name,
          type: item.type,
          startDate: new Date(item.startDate),
          endDate: item.endDate ? new Date(item.endDate) : null,
          displayOrder: i,
        })),
      });
      // Rule 8: audit log last
      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: projectId,
          eventType: 'PROJECT_PLAN_UPDATED',
          changedBy: userId,
          before: Prisma.JsonNull,
          after: { itemCount: dto.items.length } as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async getProjectHistory(projectId: string, userId: string, userRoles: Role[]): Promise<ProjectHistoryItem[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { assignedPmId: true, demand: { select: { isSmallProject: true, demandManagerId: true } } },
    });

    const isPpmOrAdmin = userRoles.includes(Role.PortfolioManager) || userRoles.includes(Role.Admin);
    const isDm = project?.demand?.isSmallProject && project?.demand?.demandManagerId === userId;
    const canView = project?.assignedPmId === userId || isDm || isPpmOrAdmin;

    if (!project || !canView) {
      throw new NotFoundException('Project not found');
    }

    const entries = await this.prisma.auditLog.findMany({
      where: { entityType: 'Project', entityId: projectId },
      orderBy: { changedAt: 'asc' },
    });

    const actorIds = [...new Set(entries.map((e) => e.changedBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    return entries.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      changedBy: e.changedBy,
      actorName: nameMap.get(e.changedBy) ?? e.changedBy,
      changedAt: e.changedAt.toISOString(),
      before: e.before ?? null,
      after: e.after ?? null,
    }));
  }
}
