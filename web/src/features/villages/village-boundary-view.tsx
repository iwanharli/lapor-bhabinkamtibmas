'use client';

import { ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { callApi } from '@/lib/api/client';
import { BoundaryMap } from './boundary-map';
import { boundaryHref } from './links';
import type { VillageGeoJson } from './types';

const CHILD_LABEL: Record<number, string> = { 1: 'provinsi', 2: 'kabupaten/kota', 3: 'kecamatan', 4: 'desa/kelurahan' };

/** Rantai nama wilayah dari kode "11.01.01.2001": tiap tingkat dicari di daftar anak induknya. */
function useTrail(kode?: string) {
  const [trail, setTrail] = useState<{ kode: string; nama: string }[]>([]);
  useEffect(() => {
    let live = true;
    const parts = kode?.split('.') ?? [];
    Promise.all(parts.map(async (_, i) => {
      const self = parts.slice(0, i + 1).join('.');
      const parent = parts.slice(0, i).join('.');
      const rows = await callApi<{ kode: string; nama: string }[]>(parent ? `/regions?parent=${parent}` : '/regions');
      return { kode: self, nama: rows.find((r) => r.kode === self)?.nama ?? self };
    })).then((t) => { if (live) setTrail(t); }).catch(() => { if (live) setTrail([]); });
    return () => { live = false; };
  }, [kode]);
  return trail;
}

/** Peta batas selebar halaman: klik wilayah untuk turun tingkat; desa tetap tampil di antara desa sekecamatan. */
export function VillageBoundaryView({ kode }: { kode?: string }) {
  const router = useRouter();
  const trail = useTrail(kode);
  const [geo, setGeo] = useState<VillageGeoJson | null>(null);
  const [busy, setBusy] = useState(true);
  const depth = kode ? kode.split('.').length : 0;
  const level = Math.min(depth + 1, 4);
  const parent = kode?.split('.').slice(0, 3).join('.');

  useEffect(() => {
    let live = true;
    setBusy(true);
    callApi<{ features: { properties: { kode: string; nama: string; chain: string }; geometry: GeoJSON.Geometry }[] }>(`/regions/boundaries?level=${level}${parent ? `&parent=${parent}` : ''}`)
      .then((d) => {
        if (!live) return;
        setGeo({
          type: 'FeatureCollection',
          features: d.features.map((f) => ({ type: 'Feature', id: f.properties.kode, properties: { id: f.properties.kode, nama: f.properties.nama, kecamatan: f.properties.chain }, geometry: f.geometry })),
        });
      })
      .catch(() => { if (live) setGeo(null); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [level, parent]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <nav aria-label="Tingkat wilayah peta" className="flex flex-wrap items-center gap-1 border-b border-line px-4 py-2.5 text-sm">
        <Link href={boundaryHref()} className={trail.length ? 'rounded-md px-1.5 py-0.5 text-primary hover:bg-primary-soft' : 'px-1.5 font-semibold'}>Indonesia</Link>
        {trail.map((t, i) => (
          <Fragment key={t.kode}>
            <ChevronRight size={14} className="text-muted/60" />
            {i < trail.length - 1
              ? <Link href={boundaryHref(t.kode)} className="rounded-md px-1.5 py-0.5 text-primary hover:bg-primary-soft">{t.nama}</Link>
              : <span className="px-1.5 font-semibold">{t.nama}</span>}
          </Fragment>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted">
          {busy && <Loader2 size={14} className="animate-spin text-primary" />}
          {(geo?.features.length ?? 0).toLocaleString('id-ID')} {CHILD_LABEL[level]}{depth < 4 && level < 4 ? ' · klik untuk membuka' : ''}
        </span>
      </nav>
      <div className="h-[calc(100dvh-15rem)] min-h-[480px]">
        {geo && <BoundaryMap data={geo} highlightId={depth === 4 ? kode : undefined} wheelZoom onPick={(k) => router.push(boundaryHref(k))} />}
      </div>
    </div>
  );
}
