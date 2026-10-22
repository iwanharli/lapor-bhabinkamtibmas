import { ReportCategory, ReportStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ListReportsQuery {
  @IsOptional() @IsEnum(ReportCategory) category?: ReportCategory;
  /** DRAFT (hanya Bhabin untuk draftnya sendiri) atau SUBMITTED. */
  @IsOptional() @IsIn([ReportStatus.DRAFT, ReportStatus.SUBMITTED]) status?: ReportStatus;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() villageId?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() priority?: boolean;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class LocationDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
}

/** Buat atau perbarui draft laporan (idempoten lewat clientUuid). */
export class UpsertReportDto {
  @IsUUID() clientUuid: string;
  @IsEnum(ReportCategory) category: ReportCategory;
  @IsInt() @Min(1) schemaVersion: number;
  @IsUUID() villageId: string;
  @IsDateString() occurredAt: string;
  @ValidateNested() @Type(() => LocationDto) location: LocationDto;
  @IsOptional() @IsNumber() @Min(0) gpsAccuracyM?: number;
  @IsOptional() @IsBoolean() isMockLocation?: boolean;
  @IsObject() data: Record<string, unknown>;
}

export class UpdateReportDto {
  @IsOptional() @IsUUID() villageId?: string;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @ValidateNested() @Type(() => LocationDto) location?: LocationDto;
  @IsOptional() @IsNumber() @Min(0) gpsAccuracyM?: number;
  @IsOptional() @IsBoolean() isMockLocation?: boolean;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
}

export class RevealDto {
  @IsString() @MaxLength(300) @Transform(({ value }) => String(value ?? '').trim()) @IsNotEmpty({ message: 'Alasan wajib diisi' }) reason: string;
}
