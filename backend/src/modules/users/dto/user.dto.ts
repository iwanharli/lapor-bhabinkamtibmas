import { UserRole } from '@prisma/client';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

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
