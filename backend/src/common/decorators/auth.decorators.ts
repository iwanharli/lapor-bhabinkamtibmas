import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const ALLOW_PENDING_PASSWORD = 'allowPendingPassword';

/** Endpoint tanpa login (login, refresh, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Boleh diakses walau pengguna masih wajib mengganti sandi sementara (profil, ganti sandi, logout). */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

/** Peran yang boleh mengakses. Endpoint terautentikasi tanpa @Roles ditolak. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export const ALL_ROLES = Object.values(UserRole);

export interface AuthUser {
  id: string;
  nrp: string;
  role: UserRole;
  unitId: string;
  /** Masih memakai sandi sementara. */
  mustChangePassword?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
