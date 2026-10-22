import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttendanceType, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AttendancesService } from './attendances.service';

const num = ({ value }: { value: unknown }) => (value === '' || value == null ? undefined : Number(value));

class RecordDto {
  @IsUUID() clientUuid: string;
  @IsEnum(AttendanceType) type: AttendanceType;
  @IsDateString() clientTime: string;
  @Transform(num) @IsNumber() @Min(-90) @Max(90) lat: number;
  @Transform(num) @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsOptional() @Transform(num) @IsNumber() @Min(0) gpsAccuracyM?: number;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() isMockLocation?: boolean;
}

const VIEWERS = [UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR];

@Controller('attendances')
export class AttendancesController {
  constructor(private attendances: AttendancesService) {}

  /** Check-in / check-out (multipart: field di bawah + file `selfie`). */
  @Post()
  @Roles(UserRole.BHABIN)
  @UseInterceptors(FileInterceptor('selfie', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  record(@CurrentUser() me: AuthUser, @Body() dto: RecordDto, @UploadedFile() selfie?: Express.Multer.File) {
    return this.attendances.record(me, dto, selfie);
  }

  @Get('me')
  @Roles(UserRole.BHABIN)
  mine(@CurrentUser() me: AuthUser) {
    return this.attendances.mine(me);
  }

  /** GET /attendances/daily?date=YYYY-MM-DD&unitId=&q=&status=hadir|belum|terlambat|luar&page=&limit= */
  @Get('daily')
  @Roles(...VIEWERS)
  daily(@CurrentUser() me: AuthUser, @Query() q: { date?: string; unitId?: string; q?: string; status?: string; page?: string; limit?: string }) {
    return this.attendances.daily(me, {
      date: q.date || undefined, unitId: q.unitId || undefined, q: q.q || undefined, status: q.status || undefined,
      page: Math.max(Number(q.page) || 1, 1), limit: Math.min(Number(q.limit) || 20, 100),
    });
  }

  @Get(':id/selfie')
  @Roles(UserRole.BHABIN, ...VIEWERS)
  async selfie(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('thumb') thumb: string | undefined, @Res() res: Response) {
    const f = await this.attendances.selfie(me, id, thumb === '1');
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    f.stream.pipe(res);
  }
}
