import { BackLink, Card, PageHeader } from '@/components/ui';
import { UserForm } from '@/features/admin/user-form';
import { getSessionUser } from '@/lib/api/server';

/** Versi halaman penuh dari modal "Tambah pengguna" (untuk tautan langsung). */
export default async function TambahPenggunaPage() {
  const me = await getSessionUser();
  return (
    <>
      <BackLink href="/admin/pengguna" />
      <PageHeader title="Tambah pengguna" subtitle="Sandi sementara dibuat otomatis dan wajib diganti saat login pertama." />
      <Card className="max-w-3xl">
        <UserForm canAssignSuperadmin={me?.role === 'SUPERADMIN'} />
      </Card>
    </>
  );
}
