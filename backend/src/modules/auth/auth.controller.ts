import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ALL_ROLES, AllowPendingPassword, AuthUser, CurrentUser, Public, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/auth.dto';

const clientInfo = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  @Public()
  // Batas percobaan login per IP per menit; dapat dilonggarkan untuk dev/CI lewat LOGIN_RATE_LIMIT.
  @Throttle({ default: { ttl: 60_000, limit: () => Number(process.env.LOGIN_RATE_LIMIT ?? 10) } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, clientInfo(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, clientInfo(req));
  }

  /** Cukup dengan refresh token, agar logout tetap bisa dilakukan setelah access token habis. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  /** Mengembalikan token baru; sesi lain di semua perangkat dicabut. */
  @Roles(...ALL_ROLES)
  @AllowPendingPassword()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() me: AuthUser, @Req() req: Request) {
    const device = req.headers['x-device-id'] as string | undefined;
    const row = device ? await this.prisma.device.findUnique({ where: { userId_deviceId: { userId: me.id, deviceId: device } } }) : null;
    return this.auth.changePassword(me.id, dto, row?.id);
  }

  @Roles(...ALL_ROLES)
  @AllowPendingPassword()
  @Get('me')
  me(@CurrentUser() me: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: {
        id: true, nrp: true, nama: true, pangkat: true, jabatan: true, role: true, mustChangePassword: true,
        unit: { select: { id: true, nama: true, level: true, timezone: true } },
        villages: { where: { until: null }, select: { village: { select: { id: true, nama: true, kecamatan: true, kabupaten: true } } } },
      },
    });
  }
}
