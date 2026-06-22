import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GlAccountResponse } from '@helix/shared';

@Injectable()
export class GlAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<GlAccountResponse[]> {
    const rows = await this.prisma.glAccount.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, categories: true, isActive: true },
      orderBy: { code: 'asc' },
    });
    return rows as GlAccountResponse[];
  }
}
