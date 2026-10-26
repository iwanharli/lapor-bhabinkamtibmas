import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { LiveBus } from './live-bus';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({ imports: [UnitsModule], providers: [TrackingService, LiveBus], controllers: [TrackingController], exports: [TrackingService] })
export class TrackingModule {}
