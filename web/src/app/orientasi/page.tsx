import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { FaceEnrollStep, LogoutLink, ProfileStep } from '@/features/auth/onboarding-steps';
import { apiFetch } from '@/lib/api/server';

export const metadata = { title: 'Lengkapi akun' };

interface Me { nama: string; pangkat: string | null; jabatan: string | null; phone: string | null; role: string; onboarding: { password: boolean; profile: boolean; face: boolean } }

/** Orientasi pengguna baru: profil lengkap, lalu pendaftaran wajah. Middleware mengarahkan ke sini selama belum selesai. */
export default async function OrientasiPage() {
  const res = await apiFetch('/auth/me');
  if (res.status === 401) redirect('/login?expired=1');
  if (!res.ok) throw new Error(`API /auth/me gagal: ${res.status}`);
  const me = await res.json() as Me;
  if (me.onboarding.password) redirect('/ganti-sandi');
  if (!me.onboarding.profile && !me.onboarding.face) redirect('/');
  const step = me.onboarding.profile ? 1 : 2;

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(145deg,var(--navy),var(--navy-2))] p-4">
      <section className="w-full max-w-lg rounded-2xl bg-surface p-6 text-ink shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <Logo size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Langkah {step} dari 2</p>
            <h1 className="text-lg font-bold leading-tight">{step === 1 ? 'Lengkapi profil' : 'Daftarkan wajah'}</h1>
          </div>
          <LogoutLink />
        </div>
        <p className="mb-5 text-sm text-muted">{step === 1 ? `Halo, ${me.nama}. Lengkapi data Anda sebelum memakai aplikasi.` : 'Wajah akan dicocokkan setiap kali Anda masuk.'}</p>
        {step === 1
          ? <ProfileStep initial={{ nama: me.nama, pangkat: me.pangkat ?? '', jabatan: me.jabatan ?? '', phone: me.phone ?? '' }} />
          : <FaceEnrollStep />}
      </section>
    </main>
  );
}
