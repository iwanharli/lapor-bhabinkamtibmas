import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({ imports: [ReportsModule], providers: [AttachmentsService], controllers: [AttachmentsController] })
export class AttachmentsModule {}
