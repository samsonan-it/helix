import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiModule } from './modules/ai/ai.module';
import { DemandsModule } from './demands/demands.module';
import { CostCentresModule } from './cost-centres/cost-centres.module';
import { GlAccountsModule } from './gl-accounts/gl-accounts.module';
import { LegalEntitiesModule } from './legal-entities/legal-entities.module';
import { AreasModule } from './areas/areas.module';
import { CountriesModule } from './countries/countries.module';
import { PersonsModule } from './persons/persons.module';
import { HelixConfigModule } from './config/config.module';
import { AdminModule } from './admin/admin.module';
import { FinancialPlansModule } from './financial-plans/financial-plans.module';
import { NotificationModule } from './notifications/notification.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ProjectsModule } from './projects/projects.module';
import { StatusReportsModule } from './status-reports/status-reports.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health/health.controller';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    AiModule,
    DemandsModule,
    CostCentresModule,
    GlAccountsModule,
    LegalEntitiesModule,
    AreasModule,
    CountriesModule,
    PersonsModule,
    HelixConfigModule,
    AdminModule,
    FinancialPlansModule,
    NotificationModule,
    PortfolioModule,
    ProjectsModule,
    StatusReportsModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
