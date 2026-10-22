import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class DeviceDto {
  @IsString() @Length(8, 128) deviceId: string;
  @IsIn(['android', 'ios']) platform: 'android' | 'ios';
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() appVersion?: string;
}

export class LoginDto {
  @IsString() @Length(4, 20) nrp: string;
  @IsString() @MinLength(1) password: string;
  /** Diisi oleh aplikasi mobile; login web tidak mengirim device. */
  @IsOptional() @ValidateNested() @Type(() => DeviceDto) device?: DeviceDto;
}

export class RefreshDto {
  @IsString() refreshToken: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString()
  @MinLength(10, { message: 'Sandi minimal 10 karakter' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Sandi harus memuat huruf dan angka' })
  newPassword: string;
}

/** Pengguna memperbarui data pribadinya sendiri (peran, NRP & satuan hanya lewat admin). */
export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(2, 150) nama?: string;
  @IsOptional() @IsString() @MaxLength(40) pangkat?: string;
  @IsOptional() @IsString() @MaxLength(120) jabatan?: string;
  /** Kosong = hapus nomor. */
  @IsOptional() @IsString() @Matches(/^$|^(\+?62|0)8\d{7,12}$/, { message: 'Nomor HP tidak valid (mis. 081234567890)' }) phone?: string;
}
