import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { TrackingService } from './tracking.service';

class PingDto {
  @IsDateString() t: string;
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsOptional() @IsNumber() @Min(0) acc?: number;
  @IsOptional() @IsBoolean() mock?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) battery?: number;
}

class PingsDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PingDto) points: PingDto[];
}

const VIEWERS = [UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN];

@Controller('tracking')
export class TrackingController {
  constructor(private tracking: TrackingService) {}

  /** Kirim titik lokasi (bertumpuk saat offline). Hanya diterima di antara check-in dan check-out. */
  @Post('pings')
  @Roles(UserRole.BHABIN)
  pings(@CurrentUser() me: AuthUser, @Body() dto: PingsDto) {
    return this.tracking.ingest(me, dto.points);
  }

  /** Posisi terakhir Bhabin yang sedang dinas hari ini dalam cakupan. */
  @Get('live')
  @Roles(...VIEWERS)
  live(@CurrentUser() me: AuthUser, @Query('unitId') unitId?: string) {
    return this.tracking.live(me, unitId || undefined);
  }

  /** Rute harian satu Bhabin (akses tercatat di log audit). */
  @Get('route')
  @Roles(...VIEWERS)
  route(@CurrentUser() me: AuthUser, @Query('userId') userId: string, @Query('date') date?: string) {
    return this.tracking.route(me, userId, date || undefined);
  }
}
