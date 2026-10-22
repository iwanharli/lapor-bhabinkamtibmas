import { ArrowLeft, Home, ShieldX } from 'lucide-react';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui';

export default function AccessDeniedPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-bg px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(217,35,50,.12),transparent_70%)]" />
      <section className="relative w-full max-w-2xl rounded-3xl border border-line bg-surface p-7 text-center shadow-[0_28px_80px_-44px_rgba(16,43,88,.4)] sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-danger-soft text-danger">
          <ShieldX size={30} strokeWidth={1.8} />
        </div>
        <p className="mt-6 font-mono text-sm font-bold tracking-[0.2em] text-danger">KESALAHAN 403</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Akses dibatasi</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Akun Anda tidak memiliki izin untuk membuka informasi ini. Jika Anda merasa seharusnya memiliki akses, hubungi administrator unit.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" size="lg" className="rounded-xl" icon={<Home size={16} />}>Ke halaman utama</ButtonLink>
          <Link href="/laporan" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-bg">
            <ArrowLeft size={16} /> Kembali ke laporan
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted">Lapor Bhabinkamtibmas · Baharkam Polri</p>
      </section>
    </main>
  );
}
