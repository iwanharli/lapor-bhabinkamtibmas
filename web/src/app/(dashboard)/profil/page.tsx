import { ProfileView, type Profile } from '@/features/profile/profile-view';
import { apiGet } from '@/lib/api/server';

export const metadata = { title: 'Profil saya' };

export default async function ProfilPage() {
  const p = await apiGet<Profile>('/auth/profile');
  return <ProfileView p={p} />;
}
