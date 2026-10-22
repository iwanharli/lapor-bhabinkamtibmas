import { isAdmin } from '@/components/layout/nav';
import { Alert, PageHeader } from '@/components/ui';
import { getSessionUser } from '@/lib/api/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (isAdmin(user?.role)) return children;
  return (
    <>
      <PageHeader title="Akses dibatasi" />
      <Alert>Halaman ini hanya untuk admin unit dan superadmin.</Alert>
    </>
  );
}
