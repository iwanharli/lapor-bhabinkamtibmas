import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { VillagesController } from './villages.controller';
import { VillagesService } from './villages.service';

@Module({ imports: [UnitsModule], providers: [VillagesService], controllers: [VillagesController], exports: [VillagesService] })
export class VillagesModule {}
