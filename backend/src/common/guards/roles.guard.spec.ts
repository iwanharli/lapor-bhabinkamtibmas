import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC, ROLES } from '../decorators/auth.decorators';
import { RolesGuard } from './roles.guard';

function ctx(user: { role: UserRole } | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardWith(meta: Record<string, unknown>) {
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('mengizinkan endpoint publik tanpa pengguna', () => {
    expect(guardWith({ [IS_PUBLIC]: true }).canActivate(ctx(undefined))).toBe(true);
  });

  it('menolak endpoint yang tidak menyatakan peran (deny by default)', () => {
    expect(() => guardWith({}).canActivate(ctx({ role: UserRole.SUPERADMIN }))).toThrow(ForbiddenException);
  });

  it('mengizinkan peran yang tercantum', () => {
    const g = guardWith({ [ROLES]: [UserRole.ADMIN_UNIT, UserRole.SUPERADMIN] });
    expect(g.canActivate(ctx({ role: UserRole.ADMIN_UNIT }))).toBe(true);
  });

  it('menolak peran yang tidak tercantum', () => {
    const g = guardWith({ [ROLES]: [UserRole.SUPERADMIN] });
    expect(() => g.canActivate(ctx({ role: UserRole.BHABIN }))).toThrow(ForbiddenException);
  });
});
