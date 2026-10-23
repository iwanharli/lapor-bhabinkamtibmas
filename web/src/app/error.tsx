'use client';

import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui';

/** File JS/CSS versi lama sudah tidak ada setelah deploy baru. */
const STALE = /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Failed to fetch/i;

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Halaman dibuka sebelum versi baru dipasang: muat ulang sekali agar memakai file terbaru.
  useEffect(() => {
    if (!STALE.test(`${error.name} ${error.message}`)) return;
    try {
      if (sessionStorage.getItem('reload-after-deploy') === location.pathname) return;
      sessionStorage.setItem('reload-after-deploy', location.pathname);
    } catch {
      /* penyimpanan tidak tersedia: tetap muat ulang sekali */
    }
    location.reload();
  }, [error]);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-bg px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(36,79,145,.15),transparent_70%)]" />
      <section className="relative w-full max-w-xl rounded-3xl border border-line bg-surface p-7 text-center shadow-[0_28px_80px_-44px_rgba(16,43,88,.4)] sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-danger/15 bg-danger-soft text-danger">
          <ShieldAlert size={30} strokeWidth={1.8} />
        </div>
        <p className="mt-6 font-mono text-6xl font-bold tracking-[-0.08em] text-danger sm:text-7xl">500</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Halaman sedang bermasalah</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Maaf, halaman ini tidak dapat dimuat dengan baik. Coba muat ulang, atau kembali ke halaman utama.
        </p>
        {error.digest && <p className="mt-4 font-mono text-xs text-muted">Kode referensi: {error.digest}</p>}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" className="rounded-xl" icon={<RefreshCw size={16} />} onClick={reset}>Coba lagi</Button>
          <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-bg">
            <ArrowLeft size={16} /> Ke halaman utama
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted">Lapor Bhabinkamtibmas · Baharkam Polri</p>
      </section>
    </main>
  );
}
