import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminService } from './admin.service';
import { AdminReferenceDataController } from './admin-reference-data.controller';
import { AdminReferenceDataService } from './admin-reference-data.service';
import { AdminSystemConfigController } from './admin-system-config.controller';
import { AdminFeatureFlagsController } from './admin-feature-flags.controller';
import { AdminAuditController } from './admin-audit.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminUsersController, AdminReferenceDataController, AdminSystemConfigController, AdminFeatureFlagsController, AdminAuditController],
  providers: [AdminService, AdminReferenceDataService],
})
export class AdminModule {}
