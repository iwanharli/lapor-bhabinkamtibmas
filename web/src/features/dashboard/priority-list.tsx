import { ArrowUpRight, Check, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { tanggalJam } from '@/lib/format';
import type { Overview } from '@/lib/types';

const MAX = 6;

/** Deteksi dini prioritas terbaru (maks. 6, bergulir bila kartu pendek) dengan tautan ke daftar lengkap. */
export function PriorityList({ rows, moreHref }: { rows: Overview['priority']; moreHref: string }) {
  if (rows.length === 0) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-success/20 bg-gradient-to-br from-success-soft/70 to-surface p-5 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success"><Check size={24} /></span>
        <div>
          <p className="font-semibold text-ink">Semua aman</p>
          <p className="mt-1 text-sm text-muted">Tidak ada deteksi dini prioritas di periode ini.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-danger/20 bg-gradient-to-b from-danger-soft/60 via-surface to-surface">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger"><ShieldAlert size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Perlu ditindaklanjuti</p>
          <p className="text-xs text-muted">Deteksi dini urgensi tinggi</p>
        </div>
        <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold tabular-nums text-white">{rows.length}</span>
      </header>
      <ul className="min-h-0 flex-1 divide-y divide-danger/10 overflow-y-auto px-2">
        {rows.slice(0, MAX).map((r) => (
          <li key={r.id}>
            <Link href={`/laporan/${r.id}`} className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition hover:bg-danger-soft/50">
              <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger/50 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink group-hover:text-danger">
                  {r.data.kategori_kerawanan || 'Deteksi dini'} <span className="font-normal text-muted">· {r.village.nama}</span>
                </span>
                <span className="block truncate text-xs text-muted">{r.user.nama} · {tanggalJam(r.occurredAt, r.unit.timezone)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={moreHref} className="flex items-center justify-center gap-1 border-t border-danger/10 py-2 text-xs font-semibold text-danger hover:bg-danger-soft/50">
        {rows.length > MAX ? `Lihat semua (${rows.length})` : 'Lihat di daftar laporan'} <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
