import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { ALLOW_PENDING_PASSWORD, AuthUser, IS_PUBLIC } from '../decorators/auth.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });

    let user: AuthUser;
    try {
      const p = await this.jwt.verifyAsync(token);
      user = { id: p.sub, nrp: p.nrp, role: p.role, unitId: p.unitId, mustChangePassword: !!p.pwd, onboarding: !!p.onb };
    } catch {
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED' });
    }
    // Peran INTEGRASI hanya boleh /integration/* (token integrasi), walau sesi lama masih berlaku.
    if (user.role === UserRole.INTEGRASI) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Peran tidak diizinkan' });
    req.user = user;

    // Orientasi belum selesai (sandi sementara, profil, wajah): hanya endpoint orientasi & logout yang boleh diakses.
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, [ctx.getHandler(), ctx.getClass()]);
    if (user.mustChangePassword && !allowPending) {
      throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Ganti sandi sementara Anda terlebih dahulu' });
    }
    if (user.onboarding && !allowPending) {
      throw new ForbiddenException({ code: 'ONBOARDING_REQUIRED', message: 'Lengkapi profil dan daftarkan wajah Anda terlebih dahulu' });
    }
    return true;
  }
}
