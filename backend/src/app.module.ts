import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { StorageModule } from './common/storage/storage.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ExportsModule } from './modules/exports/exports.module';
import { AggregatesModule } from './modules/aggregates/aggregates.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { FormSchemasModule } from './modules/form-schemas/form-schemas.module';
import { HealthModule } from './modules/health/health.module';
import { MasterModule } from './modules/master/master.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UnitsModule } from './modules/units/units.module';
import { UsersModule } from './modules/users/users.module';
import { VillagesModule } from './modules/villages/villages.module';
import { RegionsModule } from './modules/regions/regions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    UnitsModule,
    UsersModule,
    VillagesModule,
    RegionsModule,
    MasterModule,
    FormSchemasModule,
    ReportsModule,
    AnalyticsModule,
    AttachmentsModule,
    AggregatesModule,
    ExportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
