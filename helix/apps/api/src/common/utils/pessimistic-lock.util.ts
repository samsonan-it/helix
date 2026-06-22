import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export async function withProjectLock<T>(
  prisma: PrismaService,
  projectId: string,
  fn: (project: { id: string }, tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "projects" WHERE id = ${projectId} FOR UPDATE
        `;
        if (rows.length === 0) {
          throw new NotFoundException(`Project ${projectId} not found`);
        }
        return fn(rows[0], tx);
      },
      { timeout: 5000 },
    );
  } catch (err) {
    if (err instanceof NotFoundException || err instanceof ConflictException) throw err;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2034' || err.code === 'P5009')
    ) {
      throw new ConflictException(`Project ${projectId} is currently being modified — please retry`);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      throw new ConflictException(`Database error on project ${projectId}: ${err.code}`);
    }
    throw err;
  }
}

/**
 * Acquires a pessimistic row-level lock on a Demand row and executes fn inside
 * the same transaction.
 *
 * Throws NotFoundException  — demand row does not exist
 * Throws ConflictException  — lock wait timeout exceeded (5 000 ms)
 * Never throws a raw Prisma error — always maps to NestJS HttpException subclass
 *
 * ALL demand status transitions MUST use withDemandLock — never bypass.
 */
export async function withDemandLock<T>(
  prisma: PrismaService,
  demandId: string,
  fn: (demand: { id: string }, tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "demands" WHERE id = ${demandId} FOR UPDATE
        `;
        if (rows.length === 0) {
          throw new NotFoundException(`Demand ${demandId} not found`);
        }
        return fn(rows[0], tx);
      },
      { timeout: 5000 },
    );
  } catch (err) {
    // Re-throw NestJS HTTP exceptions as-is (NotFoundException from inner fn)
    if (err instanceof NotFoundException || err instanceof ConflictException) {
      throw err;
    }
    // Map Prisma transaction timeout / write conflict to ConflictException
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2034' || err.code === 'P5009')
    ) {
      throw new ConflictException(
        `Demand ${demandId} is currently being modified — please retry`,
      );
    }
    // Catch-all for unexpected Prisma errors (connection issues, etc.)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      throw new ConflictException(`Database error on demand ${demandId}: ${err.code}`);
    }
    throw err;
  }
}
