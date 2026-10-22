import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReportsModule } from '../reports/reports.module';
import { UnitsModule } from '../units/units.module';
import { ExportJobsService } from './export-jobs.service';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({ imports: [ReportsModule, AnalyticsModule, UnitsModule], providers: [ExportsService, ExportJobsService], controllers: [ExportsController] })
export class ExportsModule {}
