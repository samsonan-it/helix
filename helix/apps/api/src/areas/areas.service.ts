import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AreaResponse } from '@helix/shared';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<AreaResponse[]> {
    return this.prisma.smallProjectArea.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
