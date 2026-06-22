import { Module } from '@nestjs/common';
import { CostCentresController } from './cost-centres.controller';
import { CostCentresService } from './cost-centres.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CostCentresController],
  providers: [CostCentresService],
})
export class CostCentresModule {}
