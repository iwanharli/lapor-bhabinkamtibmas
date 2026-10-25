import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReportCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Public } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { IntegrationGuard } from './integration.guard';
import { IntegrationService, Page } from './integration.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) limit?: number;
  @IsOptional() @IsString() @MaxLength(500) cursor?: string;
  @IsOptional() @IsDateString({}, { message: 'updatedSince harus ISO 8601' }) updatedSince?: string;
}

class RangeDto extends PageDto {
  @IsOptional() @Matches(DATE, { message: 'date harus YYYY-MM-DD' }) date?: string;
  @IsOptional() @Matches(DATE, { message: 'from harus YYYY-MM-DD' }) from?: string;
  @IsOptional() @Matches(DATE, { message: 'to harus YYYY-MM-DD' }) to?: string;
}

class ReportsDto extends RangeDto {
  @IsOptional() @IsEnum(ReportCategory) category?: ReportCategory;
}

class FamilyDto extends PageDto {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periode harus YYYY-MM' }) periode?: string;
}

/**
 * API baca-saja untuk Baharkam Command Center (Pusat), docs/teknis/05-api.md §9.
 * Tidak memakai JWT login: token integrasi + allowlist IP (IntegrationGuard). Setiap pemanggilan dicatat di audit log.
 */
@Controller('integration')
@Public()
@UseGuards(IntegrationGuard)
@Throttle({ default: { ttl: 60_000, limit: () => Number(process.env.INTEGRATION_RATE_LIMIT ?? 120) } })
export class IntegrationController {
  constructor(private integration: IntegrationService, private audit: AuditService) {}

  @Get('units')
  units(@Req() req: any) {
    return this.logged(req, 'units', {}, this.integration.units());
  }

  @Get('villages')
  villages(@Req() req: any, @Query() q: PageDto) {
    return this.logged(req, 'villages', q, this.integration.villages(q));
  }

  @Get('bhabins')
  bhabins(@Req() req: any, @Query() q: PageDto) {
    return this.logged(req, 'bhabins', q, this.integration.bhabins(q));
  }

  @Get('reports')
  reports(@Req() req: any, @Query() q: ReportsDto) {
    return this.logged(req, 'reports', q, this.integration.reports(q));
  }

  @Get('attendance')
  attendance(@Req() req: any, @Query() q: RangeDto) {
    return this.logged(req, 'attendance', q, this.integration.attendance(q));
  }

  @Get('prices')
  prices(@Req() req: any, @Query() q: RangeDto) {
    return this.logged(req, 'prices', q, this.integration.prices(q));
  }

  @Get('commodities')
  commodities(@Req() req: any) {
    return this.logged(req, 'commodities', {}, this.integration.commodities());
  }

  @Get('family-summary')
  familySummary(@Req() req: any, @Query() q: FamilyDto) {
    return this.logged(req, 'family-summary', q, this.integration.familySummary(q));
  }

  private async logged<T>(req: any, endpoint: string, params: object, result: Promise<Page<T>>) {
    const page = await result;
    await this.audit.log({
      actorId: req.user.id, action: 'INTEGRATION_READ', entity: 'integration', entityId: endpoint,
      meta: { endpoint, params: { ...params }, rows: page.data.length, tokenId: req.integrationTokenId },
    });
    return page;
  }
}
