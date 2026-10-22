import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
/** Request paralel dengan refresh token yang baru dirotasi masih dilayani dalam jendela ini. */
const ROTATION_GRACE_MS = 30_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async login(dto: LoginDto, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { nrp: dto.nrp }, include: { unit: true } });
    const fail = async (reason: string) => {
      await this.audit.log({ actorId: user?.id, action: 'LOGIN_FAILED', meta: { nrp: dto.nrp, reason }, ...client });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'NRP atau sandi salah' });
    };

    if (!user || !user.active) return fail('unknown_or_inactive');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({ code: 'ACCOUNT_LOCKED', message: 'Akun terkunci sementara, coba lagi nanti' });
    }
    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED
          ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLogins: failed },
      });
      return fail('bad_password');
    }

    // Aplikasi mobile hanya untuk Bhabin; dashboard web untuk peran lainnya.
    const isMobile = !!dto.device;
    if (isMobile !== (user.role === UserRole.BHABIN)) {
      throw new ForbiddenException({ code: 'WRONG_CLIENT', message: isMobile ? 'Gunakan dashboard web' : 'Gunakan aplikasi mobile' });
    }

    let deviceRowId: string | undefined;
    if (dto.device) {
      const d = await this.prisma.device.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: dto.device.deviceId } },
        create: { userId: user.id, ...dto.device, lastSeenAt: new Date() },
        update: { ...dto.device, revokedAt: null, lastSeenAt: new Date() },
      });
      deviceRowId = d.id;
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'LOGIN', meta: { client: isMobile ? 'mobile' : 'web' }, ...client });

    return {
      ...(await this.issueTokens(user, deviceRowId)),
      user: {
        id: user.id,
        nrp: user.nrp,
        nama: user.nama,
        pangkat: user.pangkat,
        role: user.role,
        unit: { id: user.unit.id, nama: user.unit.nama, level: user.unit.level },
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /** Rotasi refresh token; pemakaian ulang token yang sudah dicabut mencabut semua sesi perangkat itu. */
  async refresh(refreshToken: string, client: ClientInfo) {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true, device: true },
    });
    if (!row || row.expiresAt < new Date() || !row.user.active || row.device?.revokedAt) {
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED' });
    }
    if (row.revokedAt && row.rotatedAt && Date.now() - row.rotatedAt.getTime() < ROTATION_GRACE_MS) {
      return this.issueTokens(row.user, row.deviceId ?? undefined);
    }
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, deviceId: row.deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({ actorId: row.userId, action: 'TOKEN_REUSE_DETECTED', meta: { deviceId: row.deviceId }, ...client });
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED' });
    }

    const now = new Date();
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: now, rotatedAt: now } });
    return this.issueTokens(row.user, row.deviceId ?? undefined);
  }

  async logout(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!row || row.revokedAt) return;
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: row.userId, action: 'LOGOUT' });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Sandi lama salah' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.newPassword, { type: argon2.argon2id }), mustChangePassword: false },
    });
    await this.audit.log({ actorId: userId, action: 'PASSWORD_CHANGED' });
  }

  private async issueTokens(user: User, deviceId?: string) {
    const ttl = Number(this.config.get('JWT_ACCESS_TTL', 900));
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, nrp: user.nrp, role: user.role, unitId: user.unitId },
      { expiresIn: ttl },
    );
    const refreshTtl = Number(this.config.get(deviceId ? 'JWT_REFRESH_TTL_MOBILE' : 'JWT_REFRESH_TTL_WEB', 43200));
    const refreshToken = 'rt_' + randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: { userId: user.id, deviceId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + refreshTtl * 1000) },
    });
    return { accessToken, refreshToken, expiresIn: ttl };
  }
}
