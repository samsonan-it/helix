import { Module } from '@nestjs/common';
import { GlAccountsController } from './gl-accounts.controller';
import { GlAccountsService } from './gl-accounts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GlAccountsController],
  providers: [GlAccountsService],
})
export class GlAccountsModule {}
