'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { callApi } from '@/lib/api/client';
import { localDateStr } from '@/lib/format';
import type { Paged, ReportListItem } from '@/lib/types';
import { ReportCard } from './report-card';

/** Daftar laporan berkelompok per tanggal dengan muat-otomatis saat digulir ke bawah. */
export function ReportFeed({ initial, total, query, limit, tz }: { initial: ReportListItem[]; total: number; query: string; limit: number; tz: string }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const done = items.length >= total;

  const more = useCallback(async () => {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const page = Math.floor(items.length / limit) + 1;
      const res = await callApi<Paged<ReportListItem>>(`/reports?${query}${query ? '&' : ''}limit=${limit}&page=${page}`);
      setItems((cur) => [...cur, ...res.data.filter((r) => !cur.some((c) => c.id === r.id))]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, done, items.length, limit, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || error) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && void more(), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, done, error]);

  const today = localDateStr(0, tz);
  const yesterday = localDateStr(-1, tz);
  const dayLabel = (d: string) => d === today ? 'Hari ini' : d === yesterday ? 'Kemarin'
    : new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: d.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
  const groups: { day: string; items: ReportListItem[] }[] = [];
  for (const r of items) {
    const d = new Date(r.occurredAt).toLocaleDateString('en-CA', { timeZone: tz });
    const g = groups.at(-1);
    if (g?.day === d) g.items.push(r);
    else groups.push({ day: d, items: [r] });
  }

  return (
    <div className="mt-4 space-y-5">
      {groups.map((g) => (
        <section key={g.day}>
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {dayLabel(g.day)}<span className="h-px flex-1 bg-line" />
          </h2>
          <ul className="space-y-2.5">{g.items.map((r) => <li key={r.id}><ReportCard r={r} /></li>)}</ul>
        </section>
      ))}
      <div ref={sentinel} className="flex justify-center py-2 text-xs text-muted">
        {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Memuat…</span>
          : error ? <button type="button" onClick={() => void more()} className="rounded-lg border border-line bg-surface px-3 py-2 text-danger">Gagal memuat. Coba lagi</button>
          : done && items.length > limit ? <span>Semua {total.toLocaleString('id-ID')} laporan sudah ditampilkan</span> : null}
      </div>
    </div>
  );
}
