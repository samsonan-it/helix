import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requestContext } from '../../common/request-context';

type ModelName = 'User' | 'Demand';

/**
 * Registers Prisma query extensions on the given PrismaService to intercept
 * create and update operations, writing an entry to audit_log.
 *
 * Uses a separate base PrismaClient for audit writes to prevent infinite recursion.
 * AuditLog writes are intentionally excluded from interception.
 *
 * NOTE: Prisma v6 removed $use() middleware — this implementation uses $extends()
 * with per-model query interceptors via a dynamic extension builder.
 */
export function registerAuditExtension(prisma: PrismaService, baseClient: PrismaClient): void {
  const AUDITABLE_MODELS: ModelName[] = ['User', 'Demand'];

  function buildInterceptor(model: ModelName) {
    return {
      async create({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const result = await query(args);
        try {
          const data = (args as Record<string, unknown>)?.['data'] as Record<string, unknown>;
          const changedBy = requestContext.getStore()?.userId ?? (data?.['updatedById'] as string) ?? 'system';
          const entityId = (result as { id?: string })?.id;
          if (!entityId) {
            console.warn(`[AuditLog] ${model}.create — result has no id, skipping audit entry`);
          } else {
            await baseClient.auditLog.create({
              data: {
                entityType: model,
                entityId,
                eventType: 'create',
                changedBy,
                after: JSON.parse(JSON.stringify(result)) as object,
              },
            });
          }
        } catch (err) {
          console.error(`[AuditLog] Failed to write audit entry for ${model}.create`, err);
        }
        return result;
      },

      async update({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        let before: unknown;
        try {
          const modelDelegate = (
            baseClient as unknown as Record<
              string,
              { findUnique: (a: { where: unknown }) => Promise<unknown> }
            >
          )[model.toLowerCase()];
          before = await modelDelegate.findUnique({
            where: (args as Record<string, unknown>)['where'],
          });
        } catch {
          before = undefined;
        }

        const result = await query(args);

        try {
          const data = (args as Record<string, unknown>)?.['data'] as Record<string, unknown>;
          const changedBy = requestContext.getStore()?.userId ?? (data?.['updatedById'] as string) ?? 'system';
          const entityId = (result as { id?: string })?.id;
          if (!entityId) {
            console.warn(`[AuditLog] ${model}.update — result has no id, skipping audit entry`);
          } else {
            await baseClient.auditLog.create({
              data: {
                entityType: model,
                entityId,
                eventType: 'update',
                changedBy,
                before: before ? (JSON.parse(JSON.stringify(before)) as object) : undefined,
                after: JSON.parse(JSON.stringify(result)) as object,
              },
            });
          }
        } catch (err) {
          console.error(`[AuditLog] Failed to write audit entry for ${model}.update`, err);
        }
        return result;
      },
    };
  }

  // Apply extension to the PrismaService using $extends
  const extended = (prisma as unknown as PrismaClient).$extends({
    query: {
      user: buildInterceptor('User'),
      demand: buildInterceptor('Demand'),
    } as never,
  });

  // Proxy model delegates from the extended client back onto the service
  for (const model of AUDITABLE_MODELS) {
    const key = model.toLowerCase();
    Object.defineProperty(prisma, key, {
      get() {
        return (extended as unknown as Record<string, unknown>)[key];
      },
      configurable: true,
    });
  }
}
