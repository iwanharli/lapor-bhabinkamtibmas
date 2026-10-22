import { ChevronRight, UserSearch } from 'lucide-react';
import Link from 'next/link';
import { Avatar, cn, EmptyState, Table, Td, Th, THead, Tr } from '@/components/ui';
import { personName, relatif, tanggalJam } from '@/lib/format';
import type { UserListItem } from '@/lib/types';
import { RoleBadge } from './role-badge';

function Status({ active }: { active: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', active ? 'text-success' : 'text-muted')}>
      <span className={cn('h-2 w-2 rounded-full', active ? 'bg-success' : 'bg-muted/50')} />
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

export function UserTable({ rows, tz }: { rows: UserListItem[]; tz?: string }) {
  if (rows.length === 0) {
    return <EmptyState icon={<UserSearch size={24} />} tone="neutral" title="Tidak ada pengguna" className="py-16">Coba ubah kata kunci, peran, atau status.</EmptyState>;
  }
  return (
    <>
      {/* Layar kecil: daftar kartu */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/pengguna/${u.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-bg">
              <Avatar nama={u.nama} muted={!u.active} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{personName(u)}</p>
                <p className="truncate text-xs text-muted">NRP {u.nrp} · {u.unit.nama}</p>
                <div className="mt-1 flex items-center gap-2"><RoleBadge role={u.role} /><Status active={u.active} /></div>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table minWidth={820}>
          <THead>
            <Th className="pl-5">Pengguna</Th>
            <Th>Peran</Th>
            <Th>Unit</Th>
            <Th>Status</Th>
            <Th>Login terakhir</Th>
            <Th />
          </THead>
          <tbody>
            {rows.map((u) => (
              <Tr key={u.id} className={cn('group relative', !u.active && 'opacity-70')}>
                <Td className="pl-5">
                  <Link href={`/admin/pengguna/${u.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                    <Avatar nama={u.nama} muted={!u.active} />
                    <span className="min-w-0">
                      <span className="block font-medium group-hover:text-primary">{personName(u)}</span>
                      <span className="block font-mono text-xs text-muted">NRP {u.nrp}</span>
                    </span>
                  </Link>
                </Td>
                <Td><RoleBadge role={u.role} /></Td>
                <Td>{u.unit.nama}</Td>
                <Td><Status active={u.active} /></Td>
                <Td nowrap muted>
                  {u.lastLoginAt ? <span title={tanggalJam(u.lastLoginAt, tz)}>{relatif(u.lastLoginAt, tz)}</span> : <span className="text-muted/70">Belum pernah</span>}
                </Td>
                <Td align="right" className="pr-5">
                  <ChevronRight size={18} className="inline text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}
