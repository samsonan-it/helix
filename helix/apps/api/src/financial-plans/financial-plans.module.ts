import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancialPlansController } from './financial-plans.controller';
import { FinancialPlansService } from './financial-plans.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialPlansController],
  providers: [FinancialPlansService],
  exports: [FinancialPlansService],
})
export class FinancialPlansModule {}
