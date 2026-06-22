import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CountryResponse } from '@helix/shared';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<CountryResponse[]> {
    return this.prisma.country.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
