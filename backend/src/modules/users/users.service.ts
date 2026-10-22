import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const PUBLIC_FIELDS = {
  id: true, nrp: true, nama: true, pangkat: true, jabatan: true, role: true, phone: true,
  active: true, lastLoginAt: true, unit: { select: { id: true, nama: true, level: true } },
} satisfies Prisma.UserSelect;

/** Sandi sementara yang mudah didiktekan; wajib diganti saat login pertama. */
const tempPassword = () => 'Lapor-' + randomBytes(6).toString('base64url');

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private units: UnitsService, private audit: AuditService) {}

  private assertCanAssignRole(me: AuthUser, role: UserRole) {
    if (me.role !== UserRole.SUPERADMIN && (role === UserRole.SUPERADMIN || role === UserRole.INTEGRASI)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Peran ini hanya dapat diberikan oleh superadmin' });
    }
  }

  private async findInScope(me: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    // 404 juga untuk data di luar cakupan, agar keberadaannya tidak bocor.
    if (!user || !(await this.units.descendantIds(me.unitId)).includes(user.unitId)) {
      throw new NotFoundException({ code: 'NOT_FOUND' });
    }
    return user;
  }

  private async listWhere(me: AuthUser, q: { q?: string; role?: UserRole; active?: boolean; unitId?: string }, ignoreRole = false): Promise<Prisma.UserWhereInput> {
    if (q.unitId) await this.units.assertInScope(me.unitId, q.unitId);
    return {
      unitId: { in: await this.units.descendantIds(q.unitId ?? me.unitId) },
      ...(q.role && !ignoreRole && { role: q.role }),
      ...(q.active !== undefined && { active: q.active }),
      ...(q.q && { OR: [{ nrp: { contains: q.q } }, { nama: { contains: q.q, mode: 'insensitive' } }] }),
    };
  }

  /** Jumlah pengguna per peran (filter lain tetap berlaku), untuk tab peran. */
  async roleCounts(me: AuthUser, q: { q?: string; active?: boolean; unitId?: string }) {
    const rows = await this.prisma.user.groupBy({ by: ['role'], where: await this.listWhere(me, q, true), _count: { _all: true } });
    return { total: rows.reduce((n, r) => n + r._count._all, 0), counts: Object.fromEntries(rows.map((r) => [r.role, r._count._all])) };
  }

  async list(me: AuthUser, q: { q?: string; role?: UserRole; active?: boolean; unitId?: string; page: number; limit: number }) {
    const where = await this.listWhere(me, q);
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: PUBLIC_FIELDS, orderBy: { nama: 'asc' }, take: q.limit, skip: (q.page - 1) * q.limit }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  async get(me: AuthUser, id: string) {
    await this.findInScope(me, id);
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        ...PUBLIC_FIELDS,
        unitId: true,
        mustChangePassword: true,
        lockedUntil: true,
        createdAt: true,
        villages: {
          where: { until: null },
          select: { since: true, village: { select: { id: true, nama: true, kecamatan: true, kabupaten: true } } },
          orderBy: { village: { nama: 'asc' } },
        },
      },
    });
  }

  async create(me: AuthUser, dto: CreateUserDto) {
    this.assertCanAssignRole(me, dto.role);
    await this.units.assertInScope(me.unitId, dto.unitId);
    const password = tempPassword();
    try {
      const user = await this.prisma.user.create({
        data: { ...dto, passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
        select: PUBLIC_FIELDS,
      });
      await this.audit.log({ actorId: me.id, action: 'USER_CREATE', entity: 'user', entityId: user.id });
      return { user, temporaryPassword: password };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'DUPLICATE', message: 'NRP sudah terdaftar' });
      }
      throw e;
    }
  }

  async update(me: AuthUser, id: string, dto: UpdateUserDto) {
    await this.findInScope(me, id);
    if (dto.role) this.assertCanAssignRole(me, dto.role);
    if (dto.unitId) await this.units.assertInScope(me.unitId, dto.unitId);
    const user = await this.prisma.user.update({ where: { id }, data: dto, select: PUBLIC_FIELDS });
    if (dto.active === false) await this.revokeAllSessions(id);
    await this.audit.log({ actorId: me.id, action: 'USER_UPDATE', entity: 'user', entityId: id, meta: { fields: Object.keys(dto) } });
    return user;
  }

  async resetPassword(me: AuthUser, id: string) {
    await this.findInScope(me, id);
    const password = tempPassword();
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), mustChangePassword: true, failedLogins: 0, lockedUntil: null },
    });
    await this.revokeAllSessions(id);
    await this.audit.log({ actorId: me.id, action: 'USER_RESET_PASSWORD', entity: 'user', entityId: id });
    return { temporaryPassword: password };
  }

  async setVillages(me: AuthUser, id: string, villageIds: string[]) {
    const user = await this.findInScope(me, id);
    if (user.role !== UserRole.BHABIN) throw new ConflictException({ code: 'NOT_BHABIN', message: 'Desa binaan hanya untuk Bhabin' });

    // Desa binaan harus berada di bawah Polsek tempat Bhabin bertugas (yang sudah pasti dalam cakupan admin).
    const valid = await this.prisma.village.count({ where: { id: { in: villageIds }, polsekId: user.unitId } });
    if (valid !== villageIds.length) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'Desa binaan harus berada di wilayah Polsek tempat Bhabin bertugas' });
    }

    const today = new Date(new Date().toISOString().slice(0, 10));
    await this.prisma.$transaction(async (tx) => {
      // Riwayat penugasan dipertahankan: tutup yang dilepas, tambah yang baru.
      await tx.userVillage.updateMany({ where: { userId: id, until: null, villageId: { notIn: villageIds } }, data: { until: today } });
      const current = await tx.userVillage.findMany({ where: { userId: id, until: null }, select: { villageId: true } });
      const have = new Set(current.map((c) => c.villageId));
      const add = villageIds.filter((v) => !have.has(v));
      if (add.length) await tx.userVillage.createMany({ data: add.map((villageId) => ({ userId: id, villageId, since: today })), skipDuplicates: true });
      await this.audit.log({ actorId: me.id, action: 'USER_SET_VILLAGES', entity: 'user', entityId: id, meta: { villageIds } }, tx);
    });
    return { villageIds };
  }

  async listDevices(me: AuthUser, id: string) {
    await this.findInScope(me, id);
    return this.prisma.device.findMany({ where: { userId: id }, orderBy: { lastSeenAt: 'desc' } });
  }

  async revokeDevice(me: AuthUser, id: string, deviceRowId: string) {
    await this.findInScope(me, id);
    await this.prisma.$transaction([
      this.prisma.device.updateMany({ where: { id: deviceRowId, userId: id }, data: { revokedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { deviceId: deviceRowId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ actorId: me.id, action: 'DEVICE_REVOKE', entity: 'device', entityId: deviceRowId });
  }

  private revokeAllSessions(userId: string) {
    return this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
