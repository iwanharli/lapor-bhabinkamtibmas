import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AnalyticsService, Range } from './analytics.service';

const DAY = 86_400_000;

export function range(q: { unitId?: string; from?: string; to?: string }, defaultDays = 30): Range {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - defaultDays * DAY);
  return { unitId: q.unitId || undefined, from, to };
}

@Controller('analytics')
@Roles(UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() me: AuthUser, @Query() q: { unitId?: string; from?: string; to?: string }) {
    return this.analytics.overview(me, range(q));
  }

  @Get('bhabin-performance')
  performance(@CurrentUser() me: AuthUser, @Query() q: { unitId?: string; from?: string; to?: string }) {
    return this.analytics.bhabinPerformance(me, range(q, 30));
  }

  @Get('map')
  map(@CurrentUser() me: AuthUser, @Query() q: { unitId?: string; from?: string; to?: string; category?: string; status?: string; priority?: string }) {
    return this.analytics.mapPoints(me, range(q, 7), { category: q.category || undefined, status: q.status || undefined, priority: q.priority === 'true' });
  }

  @Get('prices/latest')
  latest(@CurrentUser() me: AuthUser, @Query('unitId') unitId?: string) {
    return this.analytics.latestPrices(me, unitId || undefined);
  }

  @Get('prices/trend')
  trend(@CurrentUser() me: AuthUser, @Query() q: { unitId?: string; from?: string; to?: string; commodityId?: string }) {
    return this.analytics.priceTrend(me, range(q), q.commodityId ? Number(q.commodityId) : undefined);
  }

  @Get('prices/by-area')
  byArea(@CurrentUser() me: AuthUser, @Query('commodityId') commodityId: string, @Query('unitId') unitId?: string) {
    return this.analytics.pricesByArea(me, Number(commodityId), unitId || undefined);
  }
}
