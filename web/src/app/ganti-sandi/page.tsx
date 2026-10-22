import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/features/auth/change-password-form';
import { getSessionUser } from '@/lib/api/server';

export default async function GantiSandiPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(80%_60%_at_50%_0%,rgb(59_130_246/0.40),transparent_70%),linear-gradient(180deg,var(--navy),var(--navy-2))] px-4 py-10">
      <ChangePasswordForm nama={user.nama} forced={user.mustChangePassword} />
    </main>
  );
}
