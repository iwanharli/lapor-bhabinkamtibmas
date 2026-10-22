import { ReportCategory, ReportStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListReportsQuery {
  @IsOptional() @IsEnum(ReportCategory) category?: ReportCategory;
  @IsOptional() @IsEnum(ReportStatus) status?: ReportStatus;
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

export class TransitionDto {
  @IsIn([ReportStatus.APPROVED, ReportStatus.NEEDS_REVISION, ReportStatus.REJECTED]) to: ReportStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
