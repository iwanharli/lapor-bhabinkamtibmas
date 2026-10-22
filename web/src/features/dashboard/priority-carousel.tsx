'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { tanggalJam } from '@/lib/format';
import type { Overview } from '@/lib/types';

export function PriorityCarousel({ rows }: { rows: Overview['priority'] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (rows.length < 2 || paused) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % rows.length), 6000);
    return () => window.clearInterval(timer);
  }, [rows.length, paused]);

  useEffect(() => setActive(0), [rows.length]);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[152px] items-center gap-4 rounded-2xl border border-success/20 bg-gradient-to-br from-success-soft/70 to-surface p-5 sm:p-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><Check size={22} /></span>
        <div>
          <p className="font-semibold text-ink">Semua aman untuk saat ini</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">Tidak ada deteksi dini prioritas terbuka pada periode ini.</p>
        </div>
      </div>
    );
  }

  const item = rows[active % rows.length];
  return (
    <section
      className="relative flex min-h-[152px] flex-col justify-between overflow-hidden rounded-2xl border border-danger/20 bg-gradient-to-br from-danger-soft/70 via-surface to-surface p-5 sm:p-6"
      aria-label="Deteksi dini prioritas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
    >
      <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-danger/5 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger"><ShieldAlert size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-danger">Perlu ditindaklanjuti</p>
          <Link key={item.id} href={`/laporan/${item.id}`} className="mt-1 block text-lg font-semibold leading-snug text-ink hover:text-danger">
            {item.data.kategori_kerawanan || 'Deteksi dini'} <span className="font-normal text-muted">· {item.village.nama}</span>
          </Link>
          <p className="mt-1 text-sm text-muted">{item.nomor} · {item.user.nama} · {tanggalJam(item.occurredAt, item.unit.timezone)}</p>
        </div>
      </div>
      <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-danger/10 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 text-xs font-medium text-muted">{active + 1} / {rows.length}</span>
          {rows.length > 1 && (
            <div className="h-1 max-w-28 flex-1 overflow-hidden rounded-full bg-danger/10" aria-hidden="true">
              <span key={active} className="priority-progress block h-full rounded-full bg-danger/65" />
            </div>
          )}
        </div>
        {rows.length > 1 && <div className="flex items-center gap-1">
          <button type="button" aria-label="Prioritas sebelumnya" onClick={() => setActive((i) => (i - 1 + rows.length) % rows.length)} className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-danger/30 hover:text-danger"><ChevronLeft size={17} /></button>
          <button type="button" aria-label="Prioritas berikutnya" onClick={() => setActive((i) => (i + 1) % rows.length)} className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-danger/30 hover:text-danger"><ChevronRight size={17} /></button>
        </div>}
      </div>
      <style jsx>{`
        .priority-progress {
          width: 0;
          animation: priority-progress 6s linear forwards;
          animation-play-state: ${paused ? 'paused' : 'running'};
        }
        @keyframes priority-progress { to { width: 100%; } }
        @media (prefers-reduced-motion: reduce) { .priority-progress { animation: none; width: 100%; } }
      `}</style>
    </section>
  );
}
