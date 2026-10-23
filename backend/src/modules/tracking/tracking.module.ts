import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({ imports: [UnitsModule], providers: [TrackingService], controllers: [TrackingController], exports: [TrackingService] })
export class TrackingModule {}
