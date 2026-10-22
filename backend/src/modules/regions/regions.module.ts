import { Module } from '@nestjs/common';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';

@Module({ providers: [RegionsService], controllers: [RegionsController] })
export class RegionsModule {}
