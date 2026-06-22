import { Test } from '@nestjs/testing';
import { LegalEntitiesService } from '../../src/legal-entities/legal-entities.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('LegalEntitiesService', () => {
  let service: LegalEntitiesService;
  let prisma: { legalEntity: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { legalEntity: { findMany: jest.fn().mockResolvedValue([]) } };
    const module = await Test.createTestingModule({
      providers: [
        LegalEntitiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(LegalEntitiesService);
  });

  it('calls prisma with isActive:true filter and name ordering', async () => {
    await service.findAllActive();
    expect(prisma.legalEntity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('returns empty array when no active legal entities exist', async () => {
    const result = await service.findAllActive();
    expect(result).toEqual([]);
  });

  it('returns mapped rows from prisma', async () => {
    const row = { id: 'id-1', code: 'LE001', name: 'Entity A' };
    prisma.legalEntity.findMany.mockResolvedValue([row]);
    const result = await service.findAllActive();
    expect(result).toEqual([row]);
  });
});
