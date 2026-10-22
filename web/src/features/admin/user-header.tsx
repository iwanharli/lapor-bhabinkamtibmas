import { Building2, CalendarPlus, Clock, Phone } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui';
import { personName, relatif, tanggal, tanggalJam } from '@/lib/format';
import type { UserDetail } from '@/lib/types';
import { RoleBadge } from './role-badge';

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted">{icon}</span>
      {children}
    </span>
  );
}

/** Kepala halaman detail pengguna. */
export function UserHeader({ user: u }: { user: UserDetail }) {
  const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.05),0_8px_24px_-12px_rgb(var(--shadow-tint)/0.16)]">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary-2 to-accent" />
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar nama={u.nama} size="lg" muted={!u.active} />
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <RoleBadge role={u.role} />
            {u.active ? <Badge tone="success">Aktif</Badge> : <Badge tone="danger">Nonaktif</Badge>}
            {locked && <Badge tone="warn">Terkunci sementara</Badge>}
            {u.mustChangePassword && <Badge tone="info">Belum ganti sandi</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{personName(u)}</h1>
          <p className="font-mono text-sm text-muted">NRP {u.nrp}</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <Meta icon={<Building2 size={16} />}>{u.unit.nama}</Meta>
            {u.phone && <Meta icon={<Phone size={16} />}>{u.phone}</Meta>}
            <Meta icon={<Clock size={16} />}>
              {u.lastLoginAt ? <span title={tanggalJam(u.lastLoginAt)}>Login {relatif(u.lastLoginAt)}</span> : 'Belum pernah login'}
            </Meta>
            <Meta icon={<CalendarPlus size={16} />}>Terdaftar {tanggal(u.createdAt)}</Meta>
          </div>
        </div>
      </div>
    </section>
  );
}
