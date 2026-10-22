import { BackLink, Card, PageHeader } from '@/components/ui';
import { UserForm } from '@/features/admin/user-form';
import { apiGet, getSessionUser } from '@/lib/api/server';
import type { UnitOption } from '@/lib/types';

/** Versi halaman penuh dari modal "Tambah pengguna" (untuk tautan langsung). */
export default async function TambahPenggunaPage() {
  const [me, units] = await Promise.all([getSessionUser(), apiGet<UnitOption[]>('/units')]);
  return (
    <>
      <BackLink href="/admin/pengguna" />
      <PageHeader title="Tambah pengguna" subtitle="Sandi sementara dibuat otomatis dan wajib diganti saat login pertama." />
      <Card className="max-w-3xl">
        <UserForm units={units} canAssignSuperadmin={me?.role === 'SUPERADMIN'} />
      </Card>
    </>
  );
}
