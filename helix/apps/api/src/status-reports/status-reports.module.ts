import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StatusReportsController } from './status-reports.controller';
import { StatusReportsService } from './status-reports.service';
import { StatusReportReminderService } from './status-report-reminder.service';

@Module({
  imports: [PrismaModule],
  controllers: [StatusReportsController],
  providers: [StatusReportsService, StatusReportReminderService],
})
export class StatusReportsModule {}
