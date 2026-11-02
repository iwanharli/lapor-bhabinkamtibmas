'use client';

import { Building2, ChevronRight, Home, Landmark, Loader2, Map as MapIcon, MapPinned, Shield, UsersRound } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Badge, cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { BoundaryMap } from './boundary-map';
import type { RegionNode, VillageGeoJson, VillageRow } from './types';
import { VillageFormButton } from './village-form';

const LEVEL: Record<number, { label: string; cls: string; icon: typeof Shield }> = {
  1: { label: 'Provinsi', cls: 'bg-primary text-white', icon: Landmark },
  2: { label: 'Kab/Kota', cls: 'bg-primary-soft text-primary', icon: Building2 },
  3: { label: 'Kecamatan', cls: 'bg-accent/15 text-accent-ink', icon: MapIcon },
  4: { label: 'Desa', cls: 'bg-success-soft text-success', icon: Home },
};
const CHILD_LABEL: Record<number, string> = { 1: 'provinsi', 2: 'kabupaten/kota', 3: 'kecamatan', 4: 'desa/kelurahan' };

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

/** Peta mengikuti wilayah terpilih: tampilkan anak-anaknya; desa tetap tampil di antara desa sekecamatan. */
function useBoundaries(selected: { kode: string; level: number } | null) {
  const [geo, setGeo] = useState<VillageGeoJson | null>(null);
  const level = selected ? Math.min(selected.level + 1, 4) : 1;
  const parent = selected?.kode.split('.').slice(0, 3).join('.');
  useEffect(() => {
    let live = true;
    callApi<{ features: { properties: { kode: string; nama: string; chain: string }; geometry: GeoJSON.Geometry }[] }>(`/regions/boundaries?level=${level}${parent ? `&parent=${parent}` : ''}`)
      .then((d) => {
        if (!live) return;
        setGeo({
          type: 'FeatureCollection',
          features: d.features.map((f) => ({ type: 'Feature', id: f.properties.kode, properties: { id: f.properties.kode, nama: f.properties.nama, kecamatan: f.properties.chain }, geometry: f.geometry })),
        });
      })
      .catch(() => { if (live) setGeo(null); });
    return () => { live = false; };
  }, [level, parent]);
  return { geo, level };
}

/** Pohon wilayah provinsi → kabupaten/kota → kecamatan → desa yang dimuat bertahap, berdampingan dengan peta batasnya. */
export function VillageExplorer({ roots }: { roots: RegionNode[] }) {
  const [children, setChildren] = useState<Record<string, RegionNode[]>>({});
  const [villages, setVillages] = useState<Record<string, VillageRow[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ kode: string; nama: string; level: number } | null>(null);
  const { geo, level } = useBoundaries(selected);

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
    setSelected({ kode: r.kode, nama: r.nama, level: r.level });
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
      const on = selected?.kode === v.kodeWilayah;
      return (
        <li key={v.id} className={cn('relative border-b border-line last:border-0', on ? 'bg-primary-soft/60' : 'hover:bg-bg/60')}>
          <Connector depth={depth} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 pr-4" style={{ paddingLeft: pad(depth) + 24 }}>
            <button type="button" onClick={() => setSelected({ kode: v.kodeWilayah, nama: v.nama, level: 4 })} className="flex min-w-0 flex-1 basis-48 items-center gap-2.5 text-left">
              <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', LEVEL[4].cls)}><Home size={14} /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{v.nama}</span>
                <span className="block truncate text-xs text-muted"><span className="font-mono">{v.kodeWilayah}</span> · {v.polsek ?? 'Belum ada Polsek'}</span>
              </span>
            </button>
            {v.hasGeometry ? <Badge tone="success">{v.luasKm2?.toLocaleString('id-ID')} km²</Badge> : <Badge tone="warn">Belum ada batas</Badge>}
            <span className={cn('inline-flex items-center gap-1 text-xs', v.bhabin ? 'text-ink' : 'text-muted/70')} title="Bhabin aktif"><Shield size={13} className="text-muted" /><strong className="tabular-nums">{v.bhabin}</strong></span>
            <span className={cn('inline-flex items-center gap-1 text-xs', v.laporan ? 'text-ink' : 'text-muted/70')} title="Laporan 30 hari"><MapPinned size={13} className="text-muted" /><strong className="tabular-nums">{v.laporan}</strong></span>
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
          <li className={cn('relative border-b border-line last:border-0', selected?.kode === r.kode ? 'bg-primary-soft/60' : 'hover:bg-bg/60')}>
            <Connector depth={depth} />
            <button type="button" aria-expanded={isOpen} onClick={() => toggle(r)} className="relative flex w-full flex-wrap items-center gap-x-4 gap-y-2 py-3 pr-4 text-left" style={{ paddingLeft: pad(depth) }}>
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
              <span className="w-32 shrink-0 text-xs" title={`${n(r.terbina)} dari ${n(r.desa)} desa punya Bhabin`}>
                <span className="flex justify-between gap-2 text-muted"><span><strong className="tabular-nums text-ink">{n(r.desa)}</strong> desa</span><span className="tabular-nums">{n(r.terbina)} terbina</span></span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></span>
              </span>
            </button>
          </li>
          {isOpen && children[r.kode] && rows(children[r.kode], depth + 1)}
          {isOpen && villages[r.kode] && villageRows(villages[r.kode], depth + 1)}
        </Fragment>
      );
    });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] xl:h-[42rem] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold">Struktur wilayah</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted"><UsersRound size={13} /> terbina = punya Bhabin aktif</p>
        </div>
        {roots.length ? <ul className="min-h-0 flex-1 overflow-y-auto">{rows(roots, 0)}</ul> : <p className="p-8 text-center text-sm text-muted">Belum ada desa dalam cakupan Anda.</p>}
      </div>
      <aside className="flex min-h-0 flex-col border-t border-line xl:border-l xl:border-t-0">
        <div className="shrink-0 border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold">Peta batas desa</p>
          <p className="truncate text-xs text-muted">{selected?.nama ?? 'Indonesia'} · {n(geo?.features.length ?? 0)} {CHILD_LABEL[level]}</p>
        </div>
        <div className="h-[420px] min-h-0 xl:h-auto xl:flex-1">
          {geo && <BoundaryMap data={geo} highlightId={selected?.level === 4 ? selected.kode : undefined} />}
        </div>
      </aside>
    </div>
  );
}
