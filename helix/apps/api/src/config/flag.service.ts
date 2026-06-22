import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlagKey } from './flag-keys';

@Injectable()
export class FlagService {
  private readonly logger = new Logger(FlagService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(key: FlagKey): Promise<boolean> {
    const record = await this.prisma.config.findUnique({ where: { key } });
    if (!record) {
      this.logger.error(`Feature flag not found in Config table: ${key} — defaulting to false`);
      return false;
    }
    return record.value;
  }
}
