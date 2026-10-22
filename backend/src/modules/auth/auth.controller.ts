import { Body, Controller, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ALL_ROLES, AllowPendingPassword, AuthUser, CurrentUser, Public, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, UpdateProfileDto } from './dto/auth.dto';
import { AuditService } from '../audit/audit.service';

const clientInfo = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService, private audit: AuditService) {}

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
  logout(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.logout(dto.refreshToken, clientInfo(req));
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

  /** Profil lengkap pengguna yang sedang masuk: identitas, satuan beserta induknya, desa binaan, perangkat, statistik & aktivitas. */
  @Get('profile')
  @Roles(...ALL_ROLES)
  async profile(@CurrentUser() me: AuthUser) {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [user, chain, reports, reports30, attendanceDays, activity] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: me.id },
        select: {
          id: true, nrp: true, nama: true, pangkat: true, jabatan: true, role: true, phone: true, active: true,
          mustChangePassword: true, lastLoginAt: true, createdAt: true, updatedAt: true,
          unit: { select: { id: true, kode: true, nama: true, level: true, timezone: true } },
          villages: {
            orderBy: [{ until: { sort: 'desc', nulls: 'first' } }, { since: 'desc' }],
            select: { since: true, until: true, village: { select: { id: true, nama: true, kodeWilayah: true, kecamatan: true, kabupaten: true, provinsi: true } } },
          },
          devices: { where: { revokedAt: null }, orderBy: { lastSeenAt: { sort: 'desc', nulls: 'last' } }, select: { id: true, platform: true, model: true, appVersion: true, lastSeenAt: true } },
        },
      }),
      // Rantai satuan dari Mabes sampai satuan pengguna.
      this.prisma.$queryRaw<{ id: string; nama: string; level: string }[]>`
        WITH RECURSIVE up AS (
          SELECT id, parent_id, nama, level::text, 0 AS d FROM units WHERE id = ${me.unitId}::uuid
          UNION ALL SELECT u.id, u.parent_id, u.nama, u.level::text, up.d + 1 FROM units u JOIN up ON u.id = up.parent_id
        ) SELECT id, nama, level FROM up ORDER BY d DESC`,
      this.prisma.report.groupBy({ by: ['status'], where: { userId: me.id }, _count: true }),
      this.prisma.report.count({ where: { userId: me.id, status: { not: 'DRAFT' }, occurredAt: { gte: since30 } } }),
      this.prisma.attendance.findMany({ where: { userId: me.id, type: 'CHECK_IN', clientTime: { gte: since30 } }, distinct: ['workDate'], select: { workDate: true } }),
      this.prisma.auditLog.findMany({ where: { actorId: me.id }, orderBy: { at: 'desc' }, take: 15, select: { id: true, action: true, entity: true, entityId: true, meta: true, at: true, ip: true, userAgent: true } }),
    ]);
    // Rincian objek aktivitas: laporan (nomor, kategori, GPS) & absensi (jenis, GPS).
    const reportIds = new Set<string>();
    const attendanceIds = new Set<string>();
    for (const a of activity) {
      const meta = (a.meta ?? {}) as Record<string, unknown>;
      if (a.entity === 'report' && a.entityId) reportIds.add(a.entityId);
      if (a.entity === 'attachment' && typeof meta.reportId === 'string') reportIds.add(meta.reportId);
      if (a.entity === 'attendance' && a.entityId) attendanceIds.add(a.entityId);
    }
    const [reps, atts] = await Promise.all([
      reportIds.size ? this.prisma.report.findMany({
        where: { id: { in: [...reportIds] } },
        select: { id: true, nomor: true, category: true, status: true, lat: true, lng: true, gpsAccuracyM: true, insideVillage: true, distanceM: true, isMockLocation: true, village: { select: { nama: true } } },
      }) : [],
      attendanceIds.size ? this.prisma.attendance.findMany({
        where: { id: { in: [...attendanceIds] } },
        select: { id: true, type: true, lat: true, lng: true, gpsAccuracyM: true, insideVillage: true, distanceM: true, isMockLocation: true, village: { select: { nama: true } } },
      }) : [],
    ]);
    const repById = new Map(reps.map((r) => [r.id, r]));
    const attById = new Map(atts.map((x) => [x.id, x]));
    const targetOf = (a: (typeof activity)[number]) => {
      const meta = (a.meta ?? {}) as Record<string, unknown>;
      const rid = a.entity === 'report' ? a.entityId : a.entity === 'attachment' ? (meta.reportId as string | undefined) : undefined;
      const r = rid ? repById.get(rid) : undefined;
      if (r) return { kind: 'report' as const, id: r.id, nomor: r.nomor, category: r.category, status: r.status, desa: r.village.nama, gps: { lat: r.lat, lng: r.lng, accuracy: r.gpsAccuracyM, insideVillage: r.insideVillage, distanceM: r.distanceM, mock: r.isMockLocation } };
      const t = a.entity === 'attendance' && a.entityId ? attById.get(a.entityId) : undefined;
      if (t) return { kind: 'attendance' as const, id: t.id, type: t.type, desa: t.village?.nama ?? null, gps: { lat: t.lat, lng: t.lng, accuracy: t.gpsAccuracyM, insideVillage: t.insideVillage, distanceM: t.distanceM, mock: t.isMockLocation } };
      return null;
    };
    const byStatus = Object.fromEntries(reports.map((r) => [r.status, r._count]));
    const priority = await this.prisma.report.count({ where: { userId: me.id, priority: true, status: { not: 'DRAFT' } } });
    return {
      ...user,
      unitChain: chain,
      stats: {
        reportsSubmitted: byStatus.SUBMITTED ?? 0, drafts: byStatus.DRAFT ?? 0, priority,
        reports30d: reports30, attendance30d: attendanceDays.length,
      },
      activity: activity.map(({ meta, entityId: _e, ...a }) => ({ ...a, id: String(a.id), client: (meta as Record<string, unknown> | null)?.client ?? null, target: targetOf({ ...a, meta, entityId: _e }) })),
    };
  }

  /** Ubah data pribadi sendiri: nama, pangkat, jabatan, No. HP. String kosong mengosongkan pangkat/jabatan/HP. */
  @Patch('profile')
  @Roles(...ALL_ROLES)
  async updateProfile(@CurrentUser() me: AuthUser, @Body() dto: UpdateProfileDto, @Req() req: Request) {
    const clean = (v?: string) => (v === undefined ? undefined : v.trim() || null);
    const data = {
      ...(dto.nama !== undefined && { nama: dto.nama.trim() }),
      ...(dto.pangkat !== undefined && { pangkat: clean(dto.pangkat) }),
      ...(dto.jabatan !== undefined && { jabatan: clean(dto.jabatan) }),
      ...(dto.phone !== undefined && { phone: clean(dto.phone) }),
    };
    const user = await this.prisma.user.update({ where: { id: me.id }, data, select: { nama: true, pangkat: true, jabatan: true, phone: true } });
    await this.audit.log({ actorId: me.id, action: 'PROFILE_UPDATE', entity: 'user', entityId: me.id, meta: { fields: Object.keys(data) }, ...clientInfo(req) });
    return user;
  }
}
