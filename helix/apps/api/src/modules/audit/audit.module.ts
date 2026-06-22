import { BeforeApplicationShutdown, Global, Module, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { registerAuditExtension } from './prisma-audit.middleware';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule implements OnModuleInit, BeforeApplicationShutdown {
  /**
   * A separate base PrismaClient instance used exclusively for audit writes.
   * This prevents infinite recursion: audit log writes bypass the query extension.
   */
  private readonly baseClient: PrismaClient;

  constructor(private readonly prismaService: PrismaService) {
    this.baseClient = new PrismaClient();
  }

  onModuleInit(): void {
    registerAuditExtension(this.prismaService, this.baseClient);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.baseClient.$disconnect();
  }
}
