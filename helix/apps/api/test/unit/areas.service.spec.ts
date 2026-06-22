import { Test } from '@nestjs/testing';
import { AreasService } from '../../src/areas/areas.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AreasService', () => {
  let service: AreasService;
  let prisma: { smallProjectArea: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { smallProjectArea: { findMany: jest.fn().mockResolvedValue([]) } };
    const module = await Test.createTestingModule({
      providers: [
        AreasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AreasService);
  });

  it('calls prisma with isActive:true filter and name ordering', async () => {
    await service.findAllActive();
    expect(prisma.smallProjectArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('returns empty array when no active areas exist', async () => {
    const result = await service.findAllActive();
    expect(result).toEqual([]);
  });

  it('returns mapped rows from prisma', async () => {
    const row = { id: 'id-1', code: 'AREA001', name: 'Area A' };
    prisma.smallProjectArea.findMany.mockResolvedValue([row]);
    const result = await service.findAllActive();
    expect(result).toEqual([row]);
  });
});
