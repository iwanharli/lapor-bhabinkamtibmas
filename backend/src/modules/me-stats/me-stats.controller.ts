import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { MeStatsService } from './me-stats.service';

@Controller('me')
export class MeStatsController {
  constructor(private stats: MeStatsService) {}

  /** GET /me/stats?days=7|30 — statistik Bhabin yang sedang masuk (tab Statistik aplikasi HP). */
  @Get('stats')
  @Roles(UserRole.BHABIN)
  get(@CurrentUser() me: AuthUser, @Query('days') days?: string) {
    return this.stats.stats(me, days === '7' ? 7 : 30);
  }
}
