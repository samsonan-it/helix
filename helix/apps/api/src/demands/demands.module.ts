import { Module } from '@nestjs/common';
import { DemandsController } from './demands.controller';
import { DemandsService } from './demands.service';
import { DemandWorkflowService } from './demand-workflow.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HelixConfigModule } from '../config/config.module';

@Module({
  imports: [PrismaModule, HelixConfigModule],
  controllers: [DemandsController],
  providers: [DemandsService, DemandWorkflowService],
})
export class DemandsModule {}
