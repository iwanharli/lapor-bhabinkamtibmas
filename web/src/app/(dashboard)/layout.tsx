import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { navFor } from '@/components/layout/nav';
import { getSessionUser } from '@/lib/api/server';
import { ROLE_LABEL } from '@/lib/format';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <AppShell sections={navFor(user.role)} user={{ nama: user.nama, role: ROLE_LABEL[user.role] ?? user.role, unit: user.unit.nama }}>
      {children}
    </AppShell>
  );
}
