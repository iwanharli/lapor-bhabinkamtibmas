import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReportsModule } from '../reports/reports.module';
import { UnitsModule } from '../units/units.module';
import { ExportsController } from './exports.controller';

@Module({ imports: [ReportsModule, AnalyticsModule, UnitsModule], controllers: [ExportsController] })
export class ExportsModule {}
