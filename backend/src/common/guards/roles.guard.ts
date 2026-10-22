import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC, ROLES } from '../decorators/auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES, targets);
    // Deny by default: setiap endpoint wajib menyatakan perannya.
    if (!roles?.length) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Endpoint belum menyatakan peran' });

    const { user } = ctx.switchToHttp().getRequest();
    if (!roles.includes(user?.role)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return true;
  }
}
