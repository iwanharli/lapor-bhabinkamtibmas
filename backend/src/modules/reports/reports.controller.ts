import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ListReportsQuery, TransitionDto } from './reports.dto';
import { ReportsService } from './reports.service';

const READERS = [UserRole.BHABIN, UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR];

@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get()
  @Roles(...READERS)
  list(@CurrentUser() me: AuthUser, @Query() q: ListReportsQuery) {
    return this.reports.list(me, q);
  }

  // Didefinisikan sebelum ':id' agar tidak tertangkap sebagai id.
  @Get('status-counts')
  @Roles(...READERS)
  statusCounts(@CurrentUser() me: AuthUser, @Query() q: ListReportsQuery) {
    return this.reports.statusCounts(me, q);
  }

  @Get(':id')
  @Roles(...READERS)
  get(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.get(me, id);
  }

  @Post(':id/transition')
  @HttpCode(200)
  @Roles(UserRole.VERIFIKATOR)
  transition(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto) {
    return this.reports.transition(me, id, dto);
  }
}
