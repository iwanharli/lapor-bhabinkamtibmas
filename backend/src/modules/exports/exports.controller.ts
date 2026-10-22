import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsIn, IsObject, IsOptional } from 'class-validator';
import { Response } from 'express';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { ExportJobsService } from './export-jobs.service';
import { EXPORT_KINDS, ExportKind, ExportsService } from './exports.service';
import { monthlyPdf } from './monthly-pdf';
import { MonthlyReportService } from './monthly-report.service';
import { monthlyXlsx } from './monthly-xlsx';

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
    private monthlyReports: MonthlyReportService,
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

  /** Laporan bulanan satu satuan (Excel/PDF; json untuk pratinjau). Tidak memuat NIK maupun data kesehatan per orang. */
  @Get('bulanan')
  @Roles(...MonthlyReportService.ROLES)
  async monthly(
    @CurrentUser() me: AuthUser, @Query() q: { bulan?: string; unitId?: string; format?: string }, @Res({ passthrough: true }) res: Response,
  ) {
    const format = q.format === 'xlsx' || q.format === 'pdf' ? q.format : 'json';
    const report = await this.monthlyReports.build(me, q.bulan ?? '', q.unitId || undefined);
    if (format === 'json') {
      // Pratinjau di web: tanpa daftar Bhabin per orang (bisa puluhan ribu baris), cukup jumlah yang perlu perhatian.
      const { bhabin, ...rest } = report;
      const perhatian = bhabin.filter((b) => b.laporan === 0 || (report.hariKerja && b.hadir / report.hariKerja < 0.5)).length;
      return { ...rest, bhabin: [], bhabinPerhatian: perhatian, perSatuan: report.perSatuan.slice(0, 15), prioritas: report.prioritas.slice(0, 5) };
    }
    await this.audit.log({ actorId: me.id, action: 'EXPORT_CREATE', entity: 'unit', entityId: report.unit.id, meta: { kind: 'bulanan', bulan: report.bulan, format } });
    const data = format === 'xlsx' ? await monthlyXlsx(report) : await monthlyPdf(report);
    const name = `laporan-bulanan-${report.unit.nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${report.bulan}.${format}`;
    res.setHeader('Content-Type', format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(data);
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
