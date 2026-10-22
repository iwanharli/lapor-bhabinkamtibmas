import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ALL_ROLES, AuthUser, CurrentUser, Public, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/auth.dto';

const clientInfo = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
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

  @Roles(...ALL_ROLES)
  @Post('change-password')
  @HttpCode(204)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() me: AuthUser) {
    return this.auth.changePassword(me.id, dto);
  }

  @Roles(...ALL_ROLES)
  @Get('me')
  me(@CurrentUser() me: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: {
        id: true, nrp: true, nama: true, pangkat: true, jabatan: true, role: true, mustChangePassword: true,
        unit: { select: { id: true, nama: true, level: true } },
        villages: { where: { until: null }, select: { village: { select: { id: true, nama: true, kecamatan: true, kabupaten: true } } } },
      },
    });
  }
}
