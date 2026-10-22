import { Module } from '@nestjs/common';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({ providers: [UnitsService], controllers: [UnitsController], exports: [UnitsService] })
export class UnitsModule {}
