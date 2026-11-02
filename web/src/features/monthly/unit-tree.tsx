'use client';

import { ChevronRight, Loader2, Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { cn, EmptyState, Input, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';

export interface MonthlyUnit { id: string; nama: string; level: string; bhabin: number; bhabinAktif: number; laporan: number; prioritas: number; kehadiranPersen: number | null }

const n = (x: number) => x.toLocaleString('id-ID');
const pct = (x: number | null) => (x == null ? '—' : `${x.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);
const LEVEL_TONE: Record<string, string> = { Polda: 'bg-primary text-white', Polres: 'bg-primary-soft text-primary', Polsek: 'bg-accent/15 text-accent-ink' };

const FILTERS: Record<string, { label: string; test: (u: MonthlyUnit) => boolean }> = {
  prioritas: { label: 'Ada laporan prioritas', test: (u) => u.prioritas > 0 },
  belum: { label: 'Ada Bhabin belum melapor', test: (u) => u.bhabinAktif < u.bhabin },
  kosong: { label: 'Tanpa laporan', test: (u) => u.laporan === 0 },
  aktif: { label: 'Ada laporan', test: (u) => u.laporan > 0 },
};

/** Rekap per satuan bertingkat (Polda → Polres → Polsek): cabang dimuat saat dibuka, dengan penyaring yang sama seperti halaman. */
export function MonthlyUnitTree({ rows, query, showAttendance }: { rows: MonthlyUnit[]; query: string; showAttendance: boolean }) {
  const [children, setChildren] = useState<Record<string, MonthlyUnit[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');

  async function toggle(u: MonthlyUnit) {
    const next = new Set(open);
    if (next.has(u.id)) {
      next.delete(u.id);
      return setOpen(next);
    }
    next.add(u.id);
    setOpen(next);
    if (children[u.id]) return;
    setLoading((s) => new Set(s).add(u.id));
    setError('');
    try {
      const params = new URLSearchParams(query);
      params.set('unitId', u.id);
      const res = await callApi<{ perSatuan: MonthlyUnit[] }>(`/exports/bulanan?${params}`);
      setChildren((c) => ({ ...c, [u.id]: res.perSatuan }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading((s) => {
        const copy = new Set(s);
        copy.delete(u.id);
        return copy;
      });
    }
  }

  // Satuan tampil bila cocok, atau bila ada turunan terbuka yang cocok agar induknya tetap terlihat.
  const needle = q.trim().toLowerCase();
  const active = !!needle || !!filter;
  const matches = useMemo(() => {
    const hit = (u: MonthlyUnit) => (!needle || u.nama.toLowerCase().includes(needle)) && (!filter || FILTERS[filter].test(u));
    const walk = (u: MonthlyUnit): boolean => hit(u) || (children[u.id] ?? []).some(walk);
    return walk;
  }, [needle, filter, children]);

  const render = (list: MonthlyUnit[], depth: number): React.ReactNode => list.filter(matches).map((u) => {
    const expandable = u.level !== 'Polsek';
    const isOpen = open.has(u.id);
    return (
      <Fragment key={u.id}>
        <tr className="hover:bg-bg/50">
          <td className="py-2.5 pr-3" style={{ paddingLeft: 12 + depth * 24 }}>
            <div className="flex items-center gap-2">
              <button type="button" disabled={!expandable} onClick={() => toggle(u)} aria-expanded={expandable ? isOpen : undefined} aria-label={`${isOpen ? 'Tutup' : 'Buka'} ${u.nama}`}
                className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-line/60 hover:text-ink', !expandable && 'invisible')}>
                {loading.has(u.id) ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={15} className={cn('transition', isOpen && 'rotate-90')} />}
              </button>
              <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', LEVEL_TONE[u.level] ?? 'bg-bg text-muted')}>{u.level}</span>
              <span className="min-w-0 truncate font-medium">{u.nama}</span>
            </div>
          </td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-success" style={{ width: `${u.bhabin ? (u.bhabinAktif / u.bhabin) * 100 : 0}%` }} /></div>
              <span className="w-14 text-right text-xs tabular-nums text-muted">{n(u.bhabinAktif)}/{n(u.bhabin)}</span>
            </div>
          </td>
          <td className={cn('px-3 py-2.5 text-right tabular-nums', u.laporan ? 'font-semibold' : 'text-muted')}>{n(u.laporan)}</td>
          <td className={cn('py-2.5 pl-3 text-right tabular-nums', showAttendance ? 'pr-3' : 'pr-5', u.prioritas ? 'font-semibold text-danger' : 'text-muted')}>{n(u.prioritas)}</td>
          {showAttendance && <td className={cn('px-5 py-2.5 text-right tabular-nums', u.kehadiranPersen ? (u.kehadiranPersen < 50 ? 'text-danger' : '') : 'text-muted')}>{pct(u.kehadiranPersen)}</td>}
        </tr>
        {isOpen && children[u.id] && render(children[u.id], depth + 1)}
      </Fragment>
    );
  });

  const body = render(rows, 0) as React.ReactNode[];

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input aria-label="Cari satuan" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari satuan…" className="pl-9" />
        </div>
        <Select aria-label="Saring satuan" value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-60">
          <option value="">Semua satuan</option>
          {Object.entries(FILTERS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
        </Select>
      </div>
      {active && <p className="border-b border-line bg-bg/50 px-5 py-2 text-xs text-muted">Pencarian mencakup satuan yang sudah dimuat. Buka cabang untuk mencari di tingkat bawahnya.</p>}
      {error && <p className="px-5 py-2 text-sm text-danger">{error}</p>}
      {body.length === 0 ? (
        <EmptyState icon={<Search size={22} />} tone="neutral" title="Tidak ada satuan">Coba ubah pencarian atau penyaring.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">Satuan</th>
                <th className="w-56 px-3 py-2.5 font-medium">Bhabin melapor</th>
                <th className="px-3 py-2.5 text-right font-medium">Laporan</th>
                <th className={cn('py-2.5 pl-3 text-right font-medium', showAttendance ? 'pr-3' : 'pr-5')}>Prioritas</th>
                {showAttendance && <th className="px-5 py-2.5 text-right font-medium">Kehadiran</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">{body}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
