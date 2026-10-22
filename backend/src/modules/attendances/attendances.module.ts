import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';

@Module({ imports: [UnitsModule], providers: [AttendancesService], controllers: [AttendancesController] })
export class AttendancesModule {}
