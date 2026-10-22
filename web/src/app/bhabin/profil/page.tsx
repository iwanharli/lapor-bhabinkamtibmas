import { ProfileView, type Profile } from '@/features/profile/profile-view';
import { apiGet } from '@/lib/api/server';

export const metadata = { title: 'Profil saya' };

export default async function ProfilBhabinPage() {
  const p = await apiGet<Profile>('/auth/profile');
  return <ProfileView p={p} compact />;
}
