import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, IS_PUBLIC } from '../decorators/auth.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });

    try {
      const p = await this.jwt.verifyAsync(token);
      req.user = { id: p.sub, nrp: p.nrp, role: p.role, unitId: p.unitId } satisfies AuthUser;
    } catch {
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED' });
    }
    return true;
  }
}
