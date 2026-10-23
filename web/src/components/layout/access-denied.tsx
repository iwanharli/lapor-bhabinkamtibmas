import { Home, ShieldX } from 'lucide-react';
import { ButtonLink } from '@/components/ui';

/** Kartu "akses dibatasi" di dalam dashboard (sidebar tetap tampil); gaya selaras halaman 404/500. */
export function AccessDenied({ who }: { who: string }) {
  return (
    <div className="grid min-h-[calc(100dvh-12rem)] place-items-center py-6">
      <section className="w-full max-w-xl rounded-3xl border border-line bg-surface p-7 text-center shadow-[0_28px_80px_-44px_rgba(16,43,88,.4)] sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <ShieldX size={26} strokeWidth={1.8} />
        </div>
        <p className="mt-5 font-mono text-5xl font-bold tracking-[-0.08em] text-danger">403</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Akses dibatasi</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Halaman ini hanya untuk {who}. Jika Anda merasa seharusnya memiliki akses, hubungi administrator unit.
        </p>
        <ButtonLink href="/" size="lg" className="mt-7 rounded-xl" icon={<Home size={16} />}>Ke halaman utama</ButtonLink>
      </section>
    </div>
  );
}
