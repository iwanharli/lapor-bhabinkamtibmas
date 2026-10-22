import { Global, Module } from '@nestjs/common';
import { AggregatesController } from './aggregates.controller';
import { AggregatesService } from './aggregates.service';

@Global()
@Module({ providers: [AggregatesService], controllers: [AggregatesController], exports: [AggregatesService] })
export class AggregatesModule {}
