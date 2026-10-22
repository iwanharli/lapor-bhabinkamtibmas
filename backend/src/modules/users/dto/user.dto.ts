import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';

export class CreateUserDto {
  @IsString() @Length(4, 20) nrp: string;
  @IsString() @Length(2, 150) nama: string;
  @IsOptional() @IsString() pangkat?: string;
  @IsOptional() @IsString() jabatan?: string;
  @IsEnum(UserRole) role: UserRole;
  @IsUUID() unitId: string;
  @IsOptional() @IsString() phone?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 150) nama?: string;
  @IsOptional() @IsString() pangkat?: string;
  @IsOptional() @IsString() jabatan?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SetVillagesDto {
  @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) villageIds: string[];
}

/** Satu baris impor CSV; nama kolom mengikuti templat impor. */
export class ImportRowDto {
  @IsOptional() @IsString() nrp?: string;
  @IsOptional() @IsString() nama?: string;
  @IsOptional() @IsString() pangkat?: string;
  @IsOptional() @IsString() jabatan?: string;
  @IsOptional() @IsString() peran?: string;
  @IsOptional() @IsString() kode_unit?: string;
  @IsOptional() @IsString() no_hp?: string;
  /** Kode wilayah desa binaan, dipisah "|". */
  @IsOptional() @IsString() desa?: string;
}

export class ImportUsersDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ImportRowDto) rows: ImportRowDto[];
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
