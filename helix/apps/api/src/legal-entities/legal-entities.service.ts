import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegalEntityResponse } from '@helix/shared';

@Injectable()
export class LegalEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<LegalEntityResponse[]> {
    return this.prisma.legalEntity.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
