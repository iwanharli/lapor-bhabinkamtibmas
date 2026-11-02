import { BadRequestException, Controller, Get, NotFoundException, ParseUUIDPipe, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AnalyticsService, Range } from './analytics.service';

const DAY = 86_400_000;

export function range(q: { unitId?: string; from?: string; to?: string }, defaultDays = 30): Range {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - defaultDays * DAY);
  return { unitId: q.unitId || undefined, from, to };
}

type MapQuery = { unitId?: string; from?: string; to?: string; category?: string; status?: string; priority?: string; bbox?: string; zoom?: string; regionCode?: string; regionLevel?: string };

function mapFilter(q: MapQuery) {
  const b = q.bbox?.split(',').map(Number);
  if (b && (b.length !== 4 || b.some((n) => !Number.isFinite(n)))) throw new BadRequestException({ code: 'INVALID_BBOX', message: 'bbox harus w,s,e,n' });
  const regionLevel = q.regionLevel ? Number(q.regionLevel) : undefined;
  if (q.regionCode && ![1, 2, 3, 4].includes(regionLevel ?? 0)) throw new BadRequestException({ code: 'INVALID_REGION_LEVEL', message: 'regionLevel harus 1–4' });
  return {
    category: q.category || undefined,
    status: q.status || undefined,
    priority: q.priority === 'true',
    bbox: b as [number, number, number, number] | undefined,
    zoom: q.zoom ? Number(q.zoom) : undefined,
    regionCode: q.regionCode || undefined,
    regionLevel,
  };
}

/** Kode wilayah Kemendagri (provinsi sampai desa); kosong = tanpa batas wilayah. */
const regionCode = (kode?: string) => {
  if (!kode) return undefined;
  if (!/^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/.test(kode)) throw new BadRequestException({ code: 'INVALID_KODE', message: 'kode wilayah tidak valid' });
  return kode;
};

@Controller('analytics')
@Roles(UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() me: AuthUser, @Query() q: { unitId?: string; from?: string; to?: string }) {
    return this.analytics.overview(me, range(q));
  }

  @Get('bhabin-performance')
  performance(
    @CurrentUser() me: AuthUser,
    @Query() q: { unitId?: string; from?: string; to?: string; q?: string; sort?: string; page?: string; limit?: string },
  ) {
    const sort = (['total', 'hari', 'nama'] as const).find((s) => s === q.sort);
    return this.analytics.bhabinPerformance(me, range(q, 30), {
      q: q.q || undefined, sort, page: Number(q.page) || 1, limit: Math.min(Number(q.limit) || 20, 100),
    });
  }

  /** GET /analytics/map?bbox=w,s,e,n&zoom= — titik atau gugus untuk area tampilan peta. */
  @Get('map')
  map(@CurrentUser() me: AuthUser, @Query() q: MapQuery) {
    return this.analytics.mapView(me, range(q, 7), mapFilter(q));
  }

  /** GET /analytics/map/summary — jumlah per kategori & prioritas terbaru (tanpa bbox). */
  @Get('map/summary')
  mapSummary(@CurrentUser() me: AuthUser, @Query() q: MapQuery) {
    return this.analytics.mapSummary(me, range(q, 7), mapFilter(q));
  }

  @Get('prices/latest')
  latest(@CurrentUser() me: AuthUser, @Query('unitId') unitId?: string, @Query('wilayah') wilayah?: string) {
    return this.analytics.latestPrices(me, unitId || undefined, regionCode(wilayah));
  }

  /** GET prices/trend?from=&to=&commodityId=&unitId=&wilayah= — tren harian. */
  @Get('prices/trend')
  trend(@CurrentUser() me: AuthUser, @Query() q: { unitId?: string; from?: string; to?: string; commodityId?: string; wilayah?: string }) {
    return this.analytics.priceTrend(me, range(q), q.commodityId ? Number(q.commodityId) : undefined, regionCode(q.wilayah));
  }

  @Get('prices/by-area')
  byArea(@CurrentUser() me: AuthUser, @Query('commodityId') commodityId: string, @Query('unitId') unitId?: string, @Query('wilayah') wilayah?: string) {
    return this.analytics.pricesByArea(me, Number(commodityId), unitId || undefined, regionCode(wilayah));
  }

  /** GET prices/regions?parent= — anak wilayah yang punya laporan harga 30 hari terakhir. */
  @Get('prices/regions')
  priceRegions(@CurrentUser() me: AuthUser, @Query('parent') parent?: string) {
    return this.analytics.priceRegions(me, regionCode(parent));
  }

  /** GET prices/markets?kode= — pasar dalam satu wilayah, sesuai isian Bhabin. */
  @Get('prices/markets')
  priceMarkets(@CurrentUser() me: AuthUser, @Query('kode') kode?: string) {
    const code = regionCode(kode);
    if (!code) throw new BadRequestException({ code: 'INVALID_KODE', message: 'kode wilayah wajib diisi' });
    return this.analytics.priceMarkets(me, code);
  }

  /** GET prices/market?desa=&nama= — komoditas di satu pasar. */
  @Get('prices/market')
  async priceMarket(@CurrentUser() me: AuthUser, @Query('desa', ParseUUIDPipe) desa: string, @Query('nama') nama?: string) {
    const market = nama?.trim() ? await this.analytics.priceMarket(me, desa, nama) : null;
    if (!market) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pasar tidak ditemukan' });
    return market;
  }

  @Get('stunting')
  stunting(@CurrentUser() me: AuthUser, @Query('unitId') unitId?: string) {
    return this.analytics.stunting(me, unitId || undefined);
  }

  @Get('stunting/regions')
  stuntingRegions(@CurrentUser() me: AuthUser, @Query() q: { level?: string; parent?: string; unitId?: string }) {
    const level = Number(q.level ?? 1);
    if (![1, 2, 3, 4].includes(level)) throw new BadRequestException({ code: 'INVALID_LEVEL', message: 'level harus 1–4' });
    return this.analytics.stuntingRegions(me, level as 1 | 2 | 3 | 4, q.parent || undefined, q.unitId || undefined);
  }
}
