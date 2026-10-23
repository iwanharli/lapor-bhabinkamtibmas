import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module';
import { UnitsModule } from '../units/units.module';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';

@Module({ imports: [UnitsModule, TrackingModule], providers: [AttendancesService], controllers: [AttendancesController] })
export class AttendancesModule {}
