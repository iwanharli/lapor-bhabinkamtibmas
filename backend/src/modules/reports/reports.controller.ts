import { Body, Controller, Delete, Get, HttpCode, Param, Patch, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ListReportsQuery, RevealDto, UpdateReportDto, UpsertReportDto } from './reports.dto';
import { ReportWriterService } from './report-writer.service';
import { ReportsService } from './reports.service';

const READERS = [UserRole.BHABIN, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR];

@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService, private writer: ReportWriterService) {}

  /** Buat/perbarui draft (idempoten lewat clientUuid). */
  @Post()
  @Roles(UserRole.BHABIN)
  upsert(@CurrentUser() me: AuthUser, @Body() dto: UpsertReportDto) {
    return this.writer.upsert(me, dto);
  }

  @Get()
  @Roles(...READERS)
  list(@CurrentUser() me: AuthUser, @Query() q: ListReportsQuery) {
    return this.reports.list(me, q);
  }

  // Didefinisikan sebelum ':id' agar tidak tertangkap sebagai id.

  @Get(':id')
  @Roles(...READERS)
  get(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.get(me, id);
  }

  @Patch(':id')
  @Roles(UserRole.BHABIN)
  update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReportDto) {
    return this.writer.update(me, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @Roles(UserRole.BHABIN)
  submit(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.writer.submit(me, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.BHABIN)
  discard(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.writer.discard(me, id);
  }

  @Post(':id/reveal-sensitive')
  @HttpCode(200)
  @Roles(UserRole.BHABIN, UserRole.PIMPINAN, UserRole.AUDITOR)
  reveal(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevealDto) {
    return this.reports.revealSensitive(me, id, dto.reason);
  }

}
