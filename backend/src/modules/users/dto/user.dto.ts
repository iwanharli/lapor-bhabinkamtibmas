import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';

/** Peran yang bisa diberikan. Verifikator tidak dipakai lagi (laporan langsung final, tanpa verifikasi). */
export const ASSIGNABLE_ROLES = Object.values(UserRole).filter((r) => r !== UserRole.VERIFIKATOR);
const ROLE_MESSAGE = { message: 'Peran tidak valid (peran Verifikator sudah tidak dipakai)' };

export class CreateUserDto {
  @IsString() @Length(4, 20) nrp: string;
  @IsString() @Length(2, 150) nama: string;
  @IsOptional() @IsString() pangkat?: string;
  @IsOptional() @IsString() jabatan?: string;
  @IsIn(ASSIGNABLE_ROLES, ROLE_MESSAGE) role: UserRole;
  @IsUUID() unitId: string;
  @IsOptional() @IsString() phone?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 150) nama?: string;
  @IsOptional() @IsString() pangkat?: string;
  @IsOptional() @IsString() jabatan?: string;
  @IsOptional() @IsIn(ASSIGNABLE_ROLES, ROLE_MESSAGE) role?: UserRole;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SetVillagesDto {
  /** 1 Bhabin membina 1 desa: kosong (lepas) atau tepat satu desa. */
  @IsArray() @ArrayUnique() @ArrayMaxSize(1, { message: 'Satu Bhabin hanya membina satu desa' }) @IsUUID('all', { each: true }) villageIds: string[];
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
