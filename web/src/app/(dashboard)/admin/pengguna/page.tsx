import { FileUp } from 'lucide-react';
import { ButtonLink, Card, CountTabs, ExportButton, PageHeader, Pagination, SearchInput, Stack, UrlSelect } from '@/components/ui';
import { AddUserButton } from '@/features/admin/add-user-button';
import { ROLE_DOT } from '@/features/admin/role-badge';
import { UserTable } from '@/features/admin/user-table';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { ROLE_LABEL } from '@/lib/format';
import type { Paged, UnitOption, UserListItem } from '@/lib/types';
import { withParams } from '@/lib/url';

const SIZES = [10, 20, 50];
const ROLES = ['BHABIN', 'VERIFIKATOR', 'PIMPINAN', 'ADMIN_UNIT', 'AUDITOR', 'SUPERADMIN'];

type Search = { q?: string; role?: string; active?: string; page?: string; limit?: string };

export default async function PenggunaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;
  const filters = { q: sp.q, active: sp.active };

  const [{ data, meta }, counts, units, me] = await Promise.all([
    apiGet<Paged<UserListItem>>(withParams('/admin/users', { ...filters, role: sp.role, page: String(page), limit: String(limit) })),
    apiGet<{ total: number; counts: Record<string, number> }>(withParams('/admin/users/role-counts', filters)),
    apiGet<UnitOption[]>('/units'),
    getSessionUser(),
  ]);

  const tabHref = (role?: string) => withParams('/admin/pengguna', { ...sp, page: undefined }, { role });
  const roles = ROLES.filter((r) => counts.counts[r] || r === sp.role);

  return (
    <>
      <PageHeader
        title="Pengguna"
        subtitle="Kelola akun personel dalam cakupan unit Anda"
        actions={
          <>
            <ExportButton path={withParams('/exports/users.csv', { role: sp.role, active: sp.active })} />
            <ButtonLink href="/admin/pengguna/impor" variant="secondary" icon={<FileUp size={16} />}>Impor CSV</ButtonLink>
            <AddUserButton units={units} canAssignSuperadmin={me?.role === 'SUPERADMIN'} />
          </>
        }
      />
      <Stack>
        <CountTabs
          active={sp.role ?? ''}
          tabs={[
            { key: '', label: 'Semua', count: counts.total, href: tabHref(undefined) },
            ...roles.map((r) => ({ key: r, label: ROLE_LABEL[r] ?? r, count: counts.counts[r] ?? 0, href: tabHref(r), dot: ROLE_DOT[r] })),
          ]}
        />
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
            <SearchInput placeholder="Cari NRP atau nama…" className="flex-1" />
            <UrlSelect
              param="active"
              label="Status akun"
              options={[
                { value: '', label: 'Semua status' },
                { value: 'true', label: 'Aktif' },
                { value: 'false', label: 'Nonaktif' },
              ]}
            />
          </div>
          <UserTable rows={data} tz={me?.unit.timezone} />
          <Pagination
            page={page}
            limit={limit}
            total={meta.total}
            sizes={SIZES}
            noun="pengguna"
            hrefFor={(p, l) => withParams('/admin/pengguna', sp, { page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })}
          />
        </Card>
      </Stack>
    </>
  );
}
