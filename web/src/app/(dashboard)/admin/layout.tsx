import { isAdmin } from '@/components/layout/nav';
import { AccessDenied } from '@/components/layout/access-denied';
import { getSessionUser } from '@/lib/api/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (isAdmin(user?.role)) return children;
  return <AccessDenied who="admin unit dan superadmin" />;
}
