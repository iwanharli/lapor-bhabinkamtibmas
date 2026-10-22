import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsIn, IsObject, IsOptional } from 'class-validator';
import { Response } from 'express';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { ExportJobsService } from './export-jobs.service';
import { EXPORT_KINDS, ExportKind, ExportsService } from './exports.service';

class CreateExportJobDto {
  @IsIn(Object.keys(EXPORT_KINDS)) kind: ExportKind;
  /** Filter yang sama dengan endpoint unduh langsung (query string). */
  @IsOptional() @IsObject() params?: Record<string, string>;
}

/**
 * Ekspor CSV. Web memakai antrean (`POST /exports/jobs` → pantau → unduh) agar ekspor besar tidak
 * menahan request; endpoint `GET /exports/*.csv` tetap ada untuk unduhan langsung yang kecil.
 */
@Controller('exports')
export class ExportsController {
  constructor(
    private exports: ExportsService,
    private jobs: ExportJobsService,
    private audit: AuditService,
  ) {}

  @Post('jobs')
  @Roles(...ALL_ROLES)
  createJob(@CurrentUser() me: AuthUser, @Body() dto: CreateExportJobDto) {
    return this.jobs.create(me, dto.kind, dto.params ?? {});
  }

  @Get('jobs')
  @Roles(...ALL_ROLES)
  listJobs(@CurrentUser() me: AuthUser) {
    return this.jobs.list(me);
  }

  @Get('jobs/:id')
  @Roles(...ALL_ROLES)
  getJob(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.get(me, id);
  }

  @Get('jobs/:id/file')
  @Roles(...ALL_ROLES)
  async jobFile(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const f = await this.jobs.file(me, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${f.name}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (f.size) res.setHeader('Content-Length', String(f.size));
    return new StreamableFile(f.stream);
  }

  @Get(':kind.csv')
  @Roles(...ALL_ROLES)
  async direct(@CurrentUser() me: AuthUser, @Param('kind') kind: string, @Query() q: Record<string, string>, @Res() res: Response) {
    this.exports.assertAllowed(me, kind);
    const out = await this.exports.build(me, kind, q);
    await this.audit.log({ actorId: me.id, action: 'EXPORT_CREATE', entity: kind, meta: { rows: out.rows, filters: { ...q } } as Prisma.InputJsonValue });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(out.csv);
  }
}
