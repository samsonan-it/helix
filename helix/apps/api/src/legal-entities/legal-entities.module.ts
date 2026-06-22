import { Module } from '@nestjs/common';
import { LegalEntitiesController } from './legal-entities.controller';
import { LegalEntitiesService } from './legal-entities.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LegalEntitiesController],
  providers: [LegalEntitiesService],
})
export class LegalEntitiesModule {}
