import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CostCentreResponse } from '@helix/shared';

@Injectable()
export class CostCentresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<CostCentreResponse[]> {
    const rows = await this.prisma.costCentre.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, isActive: true },
      orderBy: { code: 'asc' },
    });
    return rows;
  }
}
