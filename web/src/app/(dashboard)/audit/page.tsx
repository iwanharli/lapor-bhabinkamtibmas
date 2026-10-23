import { AccessDenied } from '@/components/layout/access-denied';
import { Card, PageHeader, Pagination, SearchInput, Stack, UrlSelect } from '@/components/ui';
import { actionLabel } from '@/features/audit/actions';
import { AuditTable, type AuditRow } from '@/features/audit/audit-table';
import { apiGet, getSessionUser } from '@/lib/api/server';
import type { Paged } from '@/lib/types';
import { withParams } from '@/lib/url';

const SIZES = [20, 50, 100];
const PERIODS: Record<string, number> = { '1': 1, '7': 7, '30': 30 };
type Search = { q?: string; action?: string; periode?: string; page?: string; limit?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getSessionUser();
  if (!me || !['SUPERADMIN', 'AUDITOR', 'ADMIN_UNIT'].includes(me.role)) {
    return <AccessDenied who="auditor, admin unit, dan superadmin" />;
  }

  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;
  const days = PERIODS[sp.periode ?? '7'];
  const from = days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined;

  const [{ data, meta }, actions] = await Promise.all([
    apiGet<Paged<AuditRow>>(withParams('/audit-logs', { q: sp.q, action: sp.action, from, page: String(page), limit: String(limit) })),
    apiGet<{ action: string; count: number }[]>('/audit-logs/actions'),
  ]);

  return (
    <>
      <PageHeader title="Audit log" subtitle="Jejak aktivitas pengguna: login, laporan & ralat, perubahan data, dan ekspor. Catatan tidak dapat diubah atau dihapus." />
      <Stack>
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
            <SearchInput placeholder="Cari nama pelaku, NRP, atau ID objek…" className="flex-1" />
            <UrlSelect
              param="action"
              label="Jenis aktivitas"
              className="min-w-56"
              options={[{ value: '', label: 'Semua aktivitas' }, ...actions.map((a) => ({ value: a.action, label: `${actionLabel(a.action)} (${a.count})` }))]}
            />
            <UrlSelect
              param="periode"
              label="Periode"
              options={[
                { value: '1', label: '24 jam terakhir' },
                { value: '', label: '7 hari terakhir' },
                { value: '30', label: '30 hari terakhir' },
                { value: 'semua', label: 'Semua waktu' },
              ]}
            />
          </div>
          <AuditTable rows={data} tz={me.unit.timezone} />
          <Pagination
            page={page}
            limit={limit}
            total={meta.total}
            sizes={SIZES}
            noun="aktivitas"
            hrefFor={(p, l) => withParams('/audit', sp, { page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })}
          />
        </Card>
      </Stack>
    </>
  );
}
