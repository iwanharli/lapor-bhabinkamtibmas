import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Pembatas laju per akun, bukan per IP: banyak Bhabin berbagi satu IP (CGNAT operator seluler, NAT kantor Polres),
 * sehingga batas per IP saling memblokir. Dijalankan setelah JwtAuthGuard agar req.user tersedia.
 * Tanpa sesi (mis. login): per IP + NRP — tebakan sandi per akun tetap tertahan, juga oleh penguncian akun.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user?.id) return `u:${req.user.id}`;
    const nrp = typeof req.body?.nrp === 'string' ? req.body.nrp.slice(0, 20) : '';
    return nrp ? `ip:${req.ip}:nrp:${nrp}` : `ip:${req.ip}`;
  }
}
