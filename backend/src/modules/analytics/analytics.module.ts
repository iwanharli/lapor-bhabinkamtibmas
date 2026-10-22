import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({ imports: [UnitsModule], providers: [AnalyticsService], controllers: [AnalyticsController], exports: [AnalyticsService] })
export class AnalyticsModule {}
