import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { SensitiveDataService } from '../../common/crypto/sensitive-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { hashToken, ipList, TOKEN_PREFIX } from './integration.guard';

/** Pengelolaan token integrasi Command Center (halaman admin & `npm run integrasi:token`). */
@Injectable()
export class IntegrationTokensService {
  constructor(private prisma: PrismaService, private crypto: SensitiveDataService, private audit: AuditService) {}

  async list() {
    const tokens = await this.prisma.integrationToken.findMany({
      include: { user: { select: { id: true, nrp: true, nama: true, active: true } } },
      orderBy: [{ revokedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
    });
    return {
      tokens: tokens.map(({ tokenHash: _h, tokenEnc, ...t }) => ({ ...t, copyable: !!tokenEnc && !t.revokedAt })),
      defaultIps: (process.env.INTEGRATION_ALLOWED_IPS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    };
  }

  async create(actorId: string, dto: { nama: string; allowedIps?: string[] }) {
    const owner = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!owner || owner.role !== UserRole.SUPERADMIN || !owner.active) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Token hanya dapat dibuat oleh superadmin aktif' });
    }
    const allowedIps = this.ips(dto.allowedIps);
    const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const t = await this.prisma.integrationToken.create({
      data: {
        userId: owner.id, nama: dto.nama.trim(), prefix: token.slice(0, 12), tokenHash: hashToken(token),
        tokenEnc: Buffer.from(this.crypto.encrypt({ token })), allowedIps,
      },
    });
    await this.audit.log({ actorId: owner.id, action: 'INTEGRATION_TOKEN_CREATED', entity: 'integration_token', entityId: t.id, meta: { nama: t.nama, prefix: t.prefix, pemilik: owner.nrp, allowedIps } });
    return { id: t.id, prefix: t.prefix, token };
  }

  async update(actorId: string, id: string, dto: { nama?: string; allowedIps?: string[] }) {
    const t = await this.get(id);
    if (t.revokedAt) throw new ConflictException({ code: 'TOKEN_REVOKED', message: 'Token sudah dicabut' });
    const data = { ...(dto.nama !== undefined && { nama: dto.nama.trim() }), ...(dto.allowedIps !== undefined && { allowedIps: this.ips(dto.allowedIps) }) };
    await this.prisma.integrationToken.update({ where: { id }, data });
    await this.audit.log({ actorId, action: 'INTEGRATION_TOKEN_UPDATED', entity: 'integration_token', entityId: id, meta: { prefix: t.prefix, before: { nama: t.nama, allowedIps: t.allowedIps }, after: data } });
  }

  /** Buka token untuk disalin; setiap pembukaan dicatat. */
  async reveal(actorId: string, id: string) {
    const t = await this.get(id);
    if (t.revokedAt) throw new ConflictException({ code: 'TOKEN_REVOKED', message: 'Token sudah dicabut' });
    if (!t.tokenEnc) throw new ConflictException({ code: 'TOKEN_NOT_COPYABLE', message: 'Token lama tidak tersimpan untuk disalin; buat token baru' });
    const { token } = this.crypto.decrypt(Buffer.from(t.tokenEnc)) as { token: string };
    await this.audit.log({ actorId, action: 'INTEGRATION_TOKEN_COPIED', entity: 'integration_token', entityId: id, meta: { prefix: t.prefix } });
    return { token };
  }

  /** Cabut token; salinan terenkripsinya ikut dihapus. */
  async revoke(actorId: string | null, id: string) {
    const t = await this.get(id);
    if (t.revokedAt) return false;
    await this.prisma.integrationToken.update({ where: { id }, data: { revokedAt: new Date(), tokenEnc: null } });
    await this.audit.log({ actorId: actorId ?? t.userId, action: 'INTEGRATION_TOKEN_REVOKED', entity: 'integration_token', entityId: id, meta: { prefix: t.prefix } });
    return true;
  }

  private async get(id: string) {
    const t = await this.prisma.integrationToken.findUnique({ where: { id } });
    if (!t) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Token tidak ditemukan' });
    return t;
  }

  private ips(list: string[] = []) {
    const ips = [...new Set(list.map((s) => s.trim()).filter(Boolean))];
    const bad = ips.filter((ip) => !ipList([ip]).rules.length);
    if (bad.length) throw new BadRequestException({ code: 'INVALID_IP', message: `IP/CIDR tidak valid: ${bad.join(', ')}` });
    return ips;
  }
}
