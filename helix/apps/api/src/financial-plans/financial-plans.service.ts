import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { updateFinancialPlanEntriesSchema } from '@helix/shared';
import { Role } from '@helix/types';
import type { z } from 'zod';

type UpdateFinancialPlanEntriesDto = z.infer<typeof updateFinancialPlanEntriesSchema>;
type Requester = { id: string; roles: Role[] };

@Injectable()
export class FinancialPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getByDemand(demandId: string) {
    const allEntries = await this.prisma.financialPlanEntry.findMany({ where: { demandId } });
    const entryAccountIds = new Set(allEntries.map((e) => e.glAccountId));
    const glAccounts = await this.prisma.glAccount.findMany({
      where: { OR: [{ isActive: true }, { id: { in: [...entryAccountIds] } }] },
      orderBy: [{ name: 'asc' }],
    });
    // Expand accounts with multiple categories into one row per category
    const glAccountRows = glAccounts.flatMap((g) =>
      g.categories.map((category) => ({ id: g.id, category, label: g.name, isActive: g.isActive })),
    );
    return { glAccounts: glAccountRows, entries: allEntries };
  }

  async getByProject(projectId: string) {
    await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const allEntries = await this.prisma.projectFinancialPlanEntry.findMany({ where: { projectId } });
    const entryAccountIds = new Set(allEntries.map((e) => e.glAccountId));
    const glAccounts = await this.prisma.glAccount.findMany({
      where: { OR: [{ isActive: true }, { id: { in: [...entryAccountIds] } }] },
      orderBy: [{ name: 'asc' }],
    });
    const glAccountRows = glAccounts.flatMap((g) =>
      g.categories.map((category) => ({ id: g.id, category, label: g.name, isActive: g.isActive })),
    );
    return { glAccounts: glAccountRows, entries: allEntries };
  }

  async patchProjectCells(projectId: string, dto: UpdateFinancialPlanEntriesDto, requester: Requester) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });

    if (project.assignedPmId !== requester.id) {
      throw new ForbiddenException('Only the assigned PM may edit the project financial plan');
    }

    if (!['DRAFT', 'PENDING_APPROVAL', 'IN_EXECUTION'].includes(project.status)) {
      throw new ForbiddenException('Project financial plan is not editable in the current project status');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const results = [];

        for (const entry of dto.entries) {
          const existing = await tx.projectFinancialPlanEntry.findUnique({
            where: {
              uq_project_financial_plan_entry: {
                projectId,
                glAccountId: entry.glAccountId,
                category: entry.category,
                month: entry.month,
                year: entry.year,
              },
            },
          });

          if (existing?.isActual) {
            throw new UnprocessableEntityException('Cannot edit SAP-locked actuals');
          }

          try {
            const upserted = await tx.projectFinancialPlanEntry.upsert({
              where: {
                uq_project_financial_plan_entry: {
                  projectId,
                  glAccountId: entry.glAccountId,
                  category: entry.category,
                  month: entry.month,
                  year: entry.year,
                },
              },
              create: {
                projectId,
                glAccountId: entry.glAccountId,
                category: entry.category,
                month: entry.month,
                year: entry.year,
                valueCents: entry.valueCents,
                isUserSet: true,
              },
              update: {
                valueCents: entry.valueCents,
                isUserSet: true,
              },
            });
            results.push(upserted);
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
              throw new UnprocessableEntityException(`GL account ${entry.glAccountId} not found`);
            }
            throw e;
          }
        }

        // Rule 8: audit log last in transaction
        await tx.auditLog.create({
          data: {
            entityType: 'ProjectFinancialPlan',
            entityId: projectId,
            eventType: 'PROJECT_FINANCIAL_PLAN_UPDATED',
            changedBy: requester.id,
            after: { entries: results } as never,
          },
        });

        return results;
      },
      { timeout: 5000 },
    );
  }

  async patchCells(demandId: string, dto: UpdateFinancialPlanEntriesDto, requester: Requester) {
    const demand = await this.prisma.demand.findUniqueOrThrow({ where: { id: demandId } });

    if (requester.roles.includes(Role.DemandRequester) && demand.originatorId !== requester.id) {
      throw new ForbiddenException('DemandRequester can only edit their own demands');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const results = [];

        for (const entry of dto.entries) {
          const existing = await tx.financialPlanEntry.findUnique({
            where: {
              uq_financial_plan_entry: {
                demandId,
                glAccountId: entry.glAccountId,
                category: entry.category,
                month: entry.month,
                year: entry.year,
              },
            },
          });

          if (existing?.isActual) {
            throw new UnprocessableEntityException('Cannot edit SAP-locked actuals');
          }

          try {
            const upserted = await tx.financialPlanEntry.upsert({
              where: {
                uq_financial_plan_entry: {
                  demandId,
                  glAccountId: entry.glAccountId,
                  category: entry.category,
                  month: entry.month,
                  year: entry.year,
                },
              },
              create: {
                demandId,
                glAccountId: entry.glAccountId,
                category: entry.category,
                month: entry.month,
                year: entry.year,
                valueCents: entry.valueCents,
                isUserSet: true,
              },
              update: {
                valueCents: entry.valueCents,
                isUserSet: true,
              },
            });
            results.push(upserted);
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
              throw new UnprocessableEntityException(`GL account ${entry.glAccountId} not found`);
            }
            throw e;
          }
        }

        // Rule 8: audit log last in transaction
        await tx.auditLog.create({
          data: {
            entityType: 'FinancialPlan',
            entityId: demandId,
            eventType: 'FINANCIAL_PLAN_UPDATED',
            changedBy: requester.id,
            after: results as never,
          },
        });

        return results;
      },
      { timeout: 5000 },
    );
  }
}
