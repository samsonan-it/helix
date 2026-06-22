import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectStalenessService } from './project-staleness.service';
import { FileStorageModule } from '../common/file-storage/file-storage.module';
import { FinancialPlansModule } from '../financial-plans/financial-plans.module';

@Module({
  imports: [PrismaModule, FileStorageModule, FinancialPlansModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectStalenessService],
})
export class ProjectsModule {}
