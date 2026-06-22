import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { withDemandLock } from '../../src/common/utils/pessimistic-lock.util';
import type { PrismaService } from '../../src/prisma/prisma.service';

function makePrisma(rows: { id: string }[], txError?: Error): jest.Mocked<Pick<PrismaService, '$transaction'>> {
  return {
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      if (txError) throw txError;
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue(rows),
      };
      return fn(tx);
    }),
  };
}

describe('withDemandLock', () => {
  it('executes fn with the locked demand row', async () => {
    const prisma = makePrisma([{ id: 'demand-1' }]);
    const fn = jest.fn().mockResolvedValue('result');

    const result = await withDemandLock(prisma as unknown as PrismaService, 'demand-1', fn);

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledWith({ id: 'demand-1' }, expect.anything());
  });

  it('passes { timeout: 5000 } to $transaction', async () => {
    const prisma = makePrisma([{ id: 'demand-1' }]);
    const fn = jest.fn().mockResolvedValue(undefined);

    await withDemandLock(prisma as unknown as PrismaService, 'demand-1', fn);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 5000 });
  });

  it('throws NotFoundException when demand row is missing', async () => {
    const prisma = makePrisma([]); // empty result = row not found
    const fn = jest.fn();

    await expect(withDemandLock(prisma as unknown as PrismaService, 'missing-id', fn)).rejects.toThrow(
      NotFoundException,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('throws ConflictException on Prisma P2034 (write conflict)', async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '6.0.0',
    });
    const prisma = makePrisma([], p2034);

    await expect(
      withDemandLock(prisma as unknown as PrismaService, 'demand-1', jest.fn()),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException on Prisma P5009 (transaction timeout)', async () => {
    const p5009 = new Prisma.PrismaClientKnownRequestError('timeout', {
      code: 'P5009',
      clientVersion: '6.0.0',
    });
    const prisma = makePrisma([], p5009);

    await expect(
      withDemandLock(prisma as unknown as PrismaService, 'demand-1', jest.fn()),
    ).rejects.toThrow(ConflictException);
  });

  it('re-throws NotFoundException from fn without wrapping', async () => {
    const prisma = makePrisma([{ id: 'demand-1' }]);
    const fn = jest.fn().mockRejectedValue(new NotFoundException('inner not found'));

    await expect(withDemandLock(prisma as unknown as PrismaService, 'demand-1', fn)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('never exposes a raw PrismaClientKnownRequestError', async () => {
    const rawErr = new Prisma.PrismaClientKnownRequestError('raw error', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    const prisma = makePrisma([], rawErr);

    const thrown = await withDemandLock(
      prisma as unknown as PrismaService,
      'demand-1',
      jest.fn(),
    ).catch((e) => e);

    expect(thrown).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(thrown).toBeInstanceOf(ConflictException);
  });
});
