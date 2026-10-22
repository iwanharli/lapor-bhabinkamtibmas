import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches, MinLength, ValidateNested } from 'class-validator';

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
