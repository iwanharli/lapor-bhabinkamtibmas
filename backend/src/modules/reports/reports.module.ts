import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { ReportsController } from './reports.controller';
import { ReportWriterService } from './report-writer.service';
import { ReportsService } from './reports.service';

@Module({ imports: [UnitsModule], providers: [ReportsService, ReportWriterService], controllers: [ReportsController], exports: [ReportsService] })
export class ReportsModule {}
