import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { TrackingService } from './tracking.service';

class PingDto {
  @IsDateString() t: string;
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsOptional() @IsNumber() @Min(0) acc?: number;
  @IsOptional() @IsBoolean() mock?: boolean;
}

const VIEWERS = [UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN];

@Controller('tracking')
export class TrackingController {
  constructor(private tracking: TrackingService) {}

  /** Perbarui posisi terakhir (hanya selama jam dinas). */
  @Post('location')
  @Roles(UserRole.BHABIN)
  location(@CurrentUser() me: AuthUser, @Body() dto: PingDto) {
    return this.tracking.update(me, dto);
  }

  /** Posisi realtime Bhabin yang sedang dinas hari ini dalam cakupan. */
  @Get('live')
  @Roles(...VIEWERS)
  live(@CurrentUser() me: AuthUser, @Query('unitId') unitId?: string) {
    return this.tracking.live(me, unitId || undefined);
  }
}
