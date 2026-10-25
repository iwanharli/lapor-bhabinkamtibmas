import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { BlockList, isIP } from 'net';
import { PrismaService } from '../../prisma/prisma.service';

export const TOKEN_PREFIX = 'lbi_';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Daftar IP/CIDR ("10.0.0.5", "10.1.0.0/16", IPv6) → BlockList; entri tidak valid diabaikan. */
export function ipList(entries: string[]) {
  const list = new BlockList();
  for (const e of entries.map((s) => s.trim()).filter(Boolean)) {
    const [addr, bits] = e.split('/');
    const type = isIP(addr) === 6 ? 'ipv6' : isIP(addr) === 4 ? 'ipv4' : null;
    if (!type) continue;
    if (bits) list.addSubnet(addr, Number(bits), type);
    else list.addAddress(addr, type);
  }
  return list;
}

const allowed = (list: BlockList, ip: string) => {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return isIP(v4) === 4 ? list.check(v4, 'ipv4') : isIP(ip) === 6 && list.check(ip, 'ipv6');
};

/**
 * Autentikasi /integration/*: token statis yang dibuat Superadmin, pemilik aktif,
 * dan IP pemanggil di allowlist token (atau INTEGRATION_ALLOWED_IPS). Tanpa allowlist sama sekali → ditolak.
 */
@Injectable()
export class IntegrationGuard implements CanActivate {
  private readonly defaultIps = (process.env.INTEGRATION_ALLOWED_IPS ?? '').split(',');

  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token?.startsWith(TOKEN_PREFIX)) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Token integrasi tidak valid' });

    const t = await this.prisma.integrationToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!t || t.revokedAt) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Token integrasi tidak valid' });
    if (!t.user.active) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Pemilik token tidak aktif' });

    const ips = t.allowedIps.length ? t.allowedIps : this.defaultIps;
    if (!allowed(ipList(ips), req.ip ?? '')) throw new ForbiddenException({ code: 'IP_NOT_ALLOWED', message: 'IP tidak diizinkan' });

    req.user = { id: t.user.id, nrp: t.user.nrp, role: t.user.role, unitId: t.user.unitId };
    req.integrationTokenId = t.id;
    // Cukup kasar (per menit) agar tidak menulis di setiap permintaan.
    if (!t.lastUsedAt || Date.now() - t.lastUsedAt.getTime() > 60_000) {
      await this.prisma.integrationToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } });
    }
    return true;
  }
}
