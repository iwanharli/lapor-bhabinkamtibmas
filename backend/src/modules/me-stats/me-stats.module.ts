import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { MeStatsController } from './me-stats.controller';
import { MeStatsService } from './me-stats.service';

@Module({ imports: [UnitsModule], providers: [MeStatsService], controllers: [MeStatsController] })
export class MeStatsModule {}
