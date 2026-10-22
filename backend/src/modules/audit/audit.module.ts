import { Global, Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({ imports: [UnitsModule], providers: [AuditService], controllers: [AuditController], exports: [AuditService] })
export class AuditModule {}
