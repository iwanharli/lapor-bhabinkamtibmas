'use client';

import { Building2, ChevronRight, Home, Landmark, Loader2, Map as MapIcon, Shield, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Badge, cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { boundaryHref } from './links';
import type { RegionNode, VillageRow } from './types';
import { VillageFormButton } from './village-form';

const LEVEL: Record<number, { label: string; cls: string; icon: typeof Shield }> = {
  1: { label: 'Provinsi', cls: 'bg-primary text-white', icon: Landmark },
  2: { label: 'Kab/Kota', cls: 'bg-primary-soft text-primary', icon: Building2 },
  3: { label: 'Kecamatan', cls: 'bg-accent/15 text-accent-ink', icon: MapIcon },
  4: { label: 'Desa', cls: 'bg-success-soft text-success', icon: Home },
};

const MAP_LINK = 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary';

const pad = (depth: number) => 12 + depth * 28;
const n = (x: number) => x.toLocaleString('id-ID');

/** Garis penghubung ke induk, seperti pohon unit. */
function Connector({ depth }: { depth: number }) {
  if (!depth) return null;
  const left = pad(depth - 1) + 23;
  return (
    <>
      <span className="absolute inset-y-0 w-px bg-line" style={{ left }} />
      <span className="absolute top-1/2 h-px w-3 bg-line" style={{ left }} />
    </>
  );
}

/** Pohon wilayah provinsi → kabupaten/kota → kecamatan → desa yang dimuat bertahap. */
export function VillageExplorer({ roots }: { roots: RegionNode[] }) {
  const [children, setChildren] = useState<Record<string, RegionNode[]>>({});
  const [villages, setVillages] = useState<Record<string, VillageRow[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const load = useCallback(async (r: Pick<RegionNode, 'kode' | 'level'>) => {
    setLoading((s) => new Set(s).add(r.kode));
    try {
      if (r.level === 3) {
        const res = await callApi<{ data: VillageRow[] }>(`/admin/villages?kecamatanKode=${r.kode}&limit=300`);
        setVillages((v) => ({ ...v, [r.kode]: res.data }));
      } else {
        const rows = await callApi<RegionNode[]>(`/admin/villages/tree?parent=${r.kode}`);
        setChildren((c) => ({ ...c, [r.kode]: rows }));
      }
    } finally {
      setLoading((s) => {
        const next = new Set(s);
        next.delete(r.kode);
        return next;
      });
    }
  }, []);

  // Muat ulang cabang yang terbuka setelah data server diperbarui (router.refresh saat desa diubah).
  useEffect(() => {
    open.forEach((kode) => void load({ kode, level: kode.split('.').length }));
  }, [roots]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (r: RegionNode) => {
    const next = new Set(open);
    if (next.has(r.kode)) next.delete(r.kode);
    else {
      next.add(r.kode);
      if (!children[r.kode] && !villages[r.kode]) void load(r);
    }
    setOpen(next);
  };

  const villageRows = (list: VillageRow[], depth: number) =>
    list.map((v) => {
      return (
        <li key={v.id} className={'relative border-b border-line last:border-0 hover:bg-bg/60'}>
          <Connector depth={depth} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 pr-4" style={{ paddingLeft: pad(depth) + 24 }}>
            <div className="flex min-w-0 flex-1 basis-48 items-center gap-2.5">
              <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', LEVEL[4].cls)}><Home size={14} /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{v.nama}</span>
                <span className="block truncate text-xs text-muted"><span className="font-mono">{v.kodeWilayah}</span> · {v.polsek ?? 'Belum ada Polsek'}</span>
              </span>
            </div>
            {v.hasGeometry ? <Badge tone="success">{v.luasKm2?.toLocaleString('id-ID')} km²</Badge> : <Badge tone="warn">Belum ada batas</Badge>}
            <span className={cn('whitespace-nowrap text-xs', v.bhabin ? 'text-ink' : 'text-muted')}><strong className="tabular-nums">{v.bhabin}</strong> Bhabin</span>
            <span className={cn('whitespace-nowrap text-xs', v.laporan ? 'text-ink' : 'text-muted')}><strong className="tabular-nums">{v.laporan}</strong> laporan 30 hari</span>
            <Link href={boundaryHref(v.kodeWilayah)} className={MAP_LINK}><MapIcon size={14} /> Peta</Link>
            <VillageFormButton village={v} />
          </div>
        </li>
      );
    });

  const rows = (list: RegionNode[], depth: number): React.ReactNode =>
    list.map((r) => {
      const lv = LEVEL[r.level];
      const isOpen = open.has(r.kode);
      const pct = r.desa ? (r.terbina / r.desa) * 100 : 0;
      return (
        <Fragment key={r.kode}>
          <li className={'relative flex items-center border-b border-line pr-3 last:border-0 hover:bg-bg/60'}>
            <Connector depth={depth} />
            <button type="button" aria-expanded={isOpen} onClick={() => toggle(r)} className="relative flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 py-3 pr-4 text-left" style={{ paddingLeft: pad(depth) }}>
              <span className="grid h-6 w-6 shrink-0 place-items-center text-muted">
                {loading.has(r.kode) ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={15} className={cn('transition', isOpen && 'rotate-90')} />}
              </span>
              <span className={cn('-ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg', lv.cls)}><lv.icon size={16} /></span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {r.nama}
                  <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{lv.label}</span>
                </span>
                <span className="block truncate text-xs text-muted">
                  <span className="font-mono">{r.kode}</span> · {r.satuan.length ? r.satuan.join(', ') : <span className="text-warn">satuan belum terpetakan</span>}
                </span>
              </span>
              <span className="w-40 shrink-0 text-xs" title={`${n(r.terbina)} dari ${n(r.desa)} desa punya Bhabin`}>
                <span className="flex justify-between gap-2 text-muted"><span><strong className="tabular-nums text-ink">{n(r.desa)}</strong> desa</span><span className="tabular-nums">{n(r.terbina)} terbina</span></span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></span>
              </span>
            </button>
            <Link href={boundaryHref(r.kode)} aria-label={`Lihat ${r.nama} di peta`} className={MAP_LINK}><MapIcon size={14} /> Peta</Link>
          </li>
          {isOpen && children[r.kode] && rows(children[r.kode], depth + 1)}
          {isOpen && villages[r.kode] && villageRows(villages[r.kode], depth + 1)}
        </Fragment>
      );
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="text-sm font-semibold">Struktur wilayah</p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted"><UsersRound size={13} /> terbina = punya Bhabin aktif</p>
      </div>
      {roots.length ? <ul>{rows(roots, 0)}</ul> : <p className="p-8 text-center text-sm text-muted">Belum ada desa dalam cakupan Anda.</p>}
    </div>
  );
}
