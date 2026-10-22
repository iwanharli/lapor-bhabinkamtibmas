'use client';

import 'leaflet/dist/leaflet.css';
import type { GeoJSON as GeoJSONLayer, LatLngBounds, Layer, Map as LeafletMap, PathOptions } from 'leaflet';
import { ArrowRight, Baby, Droplets, Home, Layers, Loader2, Siren, X, ZoomIn } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { withParams } from '@/lib/url';
import { AreaStats, COLORS, colorFor, countBreaks, FEW, fmt, METRICS, MetricKey } from './metrics';

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const LEVEL: Record<number, string> = { 1: 'Provinsi', 2: 'Kabupaten/Kota', 3: 'Kecamatan', 4: 'Desa/Kelurahan' };
/** Tingkat wilayah mengikuti zoom, sama seperti batas wilayah di Peta Sebaran. */
const levelFor = (zoom: number) => (zoom <= 6 ? 1 : zoom <= 8 ? 2 : zoom <= 11 ? 3 : 4);
const n = (x: number) => x.toLocaleString('id-ID');

type Collection = { level: number; extent: [number, number, number, number] | null; truncated: boolean; features: GeoJSON.Feature<GeoJSON.Geometry, AreaStats>[] };

/** Peta tematik stunting per wilayah (choropleth) — tanpa titik rumah agar keluarga tidak bisa ditunjuk. */
export function StuntingMap({ metric, unitId }: { metric: MetricKey; unitId?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<GeoJSONLayer | null>(null);
  const [data, setData] = useState<Collection | null>(null);
  const [busy, setBusy] = useState(true);
  const [hover, setHover] = useState<AreaStats | null>(null);
  const [picked, setPicked] = useState<AreaStats | null>(null);

  const m = METRICS[metric];
  const breaks = useMemo(
    () => m.breaks ?? countBreaks((data?.features ?? []).map((f) => m.value(f.properties) ?? 0)),
    [data, m],
  );

  // Peta & pemuatan data per tampilan (bbox + tingkat wilayah).
  useEffect(() => {
    let cancelled = false;
    let abort: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      const lm = L.map(el.current, { zoomControl: false, minZoom: 4, attributionControl: true }).setView([-2.5, 118], 5);
      lm.attributionControl.setPrefix(false);
      L.control.zoom({ position: 'bottomright' }).addTo(lm);
      // Peta dasar dipudarkan agar warna wilayah yang menonjol.
      L.tileLayer(TILE_URL, { maxZoom: 18, opacity: 0.45, attribution: '© OSM' }).addTo(lm);
      map.current = lm;
      let first = true;
      const load = async () => {
        abort?.abort();
        abort = new AbortController();
        const b = lm.getBounds().pad(0.15);
        setBusy(true);
        try {
          const res = await fetch(`/api/proxy${withParams('/analytics/stunting/map', {
            level: String(levelFor(lm.getZoom())), unitId, extent: first ? '1' : undefined,
            bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((x) => x.toFixed(4)).join(','),
          })}`, { signal: abort.signal });
          if (!res.ok || cancelled) return;
          const body: Collection = await res.json();
          setData(body);
          if (first && body.extent) {
            // Arahkan ke wilayah berdata di cakupan pengguna; bila tampilan berubah, moveend memuat tingkat yang sesuai.
            const [w, s, e, nn] = body.extent;
            lm.fitBounds([[s, w], [nn, e]], { padding: [40, 40], maxZoom: 13 });
          }
          first = false;
        } catch (e) {
          if ((e as Error).name !== 'AbortError') console.error(e);
        } finally {
          if (!cancelled) setBusy(false);
        }
      };
      lm.on('moveend', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
      void load();
    })();
    return () => {
      cancelled = true;
      abort?.abort();
      clearTimeout(timer);
      map.current?.remove();
      map.current = null;
    };
  }, [unitId]);

  // Gambar ulang lapisan saat data atau metrik berubah.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      const lm = map.current;
      if (cancelled || !lm || !data) return;
      layer.current?.remove();
      setHover(null); // wilayah lama sudah tidak ada di peta (mouseout tidak terpanggil)
      setPicked((p) => (p && p.level === data.level && data.features.some((f) => f.properties.kode === p.kode) ? p : null));
      const style = (f?: GeoJSON.Feature<GeoJSON.Geometry, AreaStats>): PathOptions => ({
        color: '#ffffff', weight: data.level >= 3 ? 0.6 : 1, fillOpacity: 0.78,
        fillColor: f ? colorFor(m.value(f.properties), breaks) : FEW,
      });
      layer.current = L.geoJSON(data as unknown as GeoJSON.FeatureCollection, {
        style: style as (f?: GeoJSON.Feature) => PathOptions,
        onEachFeature: (f, l: Layer) => {
          const p = f.properties as AreaStats;
          l.on({
            mouseover: (e) => { e.target.setStyle({ weight: 2.5, color: '#0f172a' }); e.target.bringToFront(); setHover(p); },
            mouseout: (e) => { layer.current?.resetStyle(e.target); setHover(null); },
            click: () => setPicked(p),
          });
        },
      }).addTo(lm);
    })();
    return () => { cancelled = true; };
  }, [data, m, breaks]);

  const zoomIn = () => {
    const lm = map.current;
    if (!lm || !picked) return;
    const f = layer.current?.getLayers().find((l) => ((l as unknown as { feature: GeoJSON.Feature }).feature.properties as AreaStats).kode === picked.kode);
    if (f && 'getBounds' in f) lm.fitBounds((f as unknown as { getBounds: () => LatLngBounds }).getBounds(), { padding: [40, 40] });
    setPicked(null);
  };

  const shown = picked ?? hover;
  const legend = [
    { color: COLORS[0], label: m.unit === '%' ? `< ${breaks[0]}%` : '0' },
    ...breaks.map((b, i) => ({
      color: COLORS[i + 1],
      label: m.unit === '%' ? (breaks[i + 1] ? `${b}–${breaks[i + 1]}%` : `≥ ${b}%`) : breaks[i + 1] && breaks[i + 1] - 1 > b ? `${b}–${breaks[i + 1] - 1}` : breaks[i + 1] ? `${b}` : `≥ ${b}`,
    })),
    ...(m.unit === '%' ? [{ color: FEW, label: 'data sedikit' }] : []),
  ];

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="map-stunting z-0 h-full w-full bg-[#eef2f6]" aria-label="Peta stunting per wilayah" />

      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl bg-surface/90 px-3 py-2 text-xs shadow ring-1 ring-line backdrop-blur">
        <Layers size={14} className="text-muted" />
        <span>Tingkat: <strong>{LEVEL[data?.level ?? 1]}</strong></span>
        <span className="text-muted">· {n(data?.features.length ?? 0)} wilayah berdata{data?.truncated ? ' (sebagian)' : ''}</span>
        {(data?.level ?? 1) < 4 && <span className="hidden items-center gap-1 text-muted sm:inline-flex"><ZoomIn size={12} /> perbesar untuk lebih rinci</span>}
        {busy && <Loader2 size={14} className="animate-spin text-primary" />}
      </div>

      <div className="absolute bottom-3 left-3 z-[500] w-64 rounded-xl bg-surface/95 p-3 text-xs shadow-lg ring-1 ring-line backdrop-blur">
        <p className="mb-2 font-semibold">{m.label}</p>
        <ul className="space-y-1">
          {legend.map((x) => (
            <li key={x.label} className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm ring-1 ring-black/10" style={{ background: x.color }} />{x.label}</li>
          ))}
        </ul>
        <p className="mt-2 leading-snug text-muted">{m.hint}</p>
      </div>

      {shown && (
        <div className="absolute right-3 top-3 z-[500] w-80 overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-line">
          <div className="flex items-start gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{LEVEL[shown.level]}</p>
              <p className="truncate font-semibold">{shown.nama}</p>
              {shown.chain && <p className="truncate text-xs text-muted">{shown.chain}</p>}
            </div>
            {picked && <button type="button" onClick={() => setPicked(null)} aria-label="Tutup" className="rounded-lg p-1 text-muted hover:bg-bg"><X size={16} /></button>}
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-muted">{m.label}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: colorFor(m.value(shown), breaks) === COLORS[0] ? undefined : colorFor(m.value(shown), breaks) }}>{fmt(m.value(shown), m.unit)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-px border-t border-line bg-line text-sm">
            {[
              [Home, 'Keluarga', n(shown.kk)],
              [Baby, 'Balita', n(shown.balita)],
              [Siren, 'Stunting · berisiko', `${n(shown.stunting)} · ${n(shown.berisiko)}`],
              [Siren, 'Belum ditangani', n(shown.belum_ditangani)],
              [Home, 'Jamban tak layak', `${n(shown.jamban_tidak_layak)} KK`],
              [Droplets, 'Air tak layak', `${n(shown.air_tidak_layak)} KK`],
            ].map(([Icon, label, v]) => {
              const I = Icon as typeof Home;
              return (
                <div key={label as string} className="bg-surface px-4 py-2">
                  <dt className="flex items-center gap-1 text-[11px] text-muted"><I size={11} /> {label as string}</dt>
                  <dd className={cn('font-semibold tabular-nums', label === 'Belum ditangani' && shown.belum_ditangani > 0 && 'text-danger')}>{v as string}</dd>
                </div>
              );
            })}
          </dl>
          {picked && (
            <div className="border-t border-line p-3">
              {picked.level === 4 ? (
                <Link href={withParams('/laporan', { category: 'MAPPING_KK', villageId: picked.kode, rentang: 'semua' })}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-110">
                  Lihat laporan Mapping desa ini <ArrowRight size={15} />
                </Link>
              ) : (
                <button type="button" onClick={zoomIn} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-bg">
                  <ZoomIn size={15} /> Perbesar ke {LEVEL[picked.level].toLowerCase()} ini
                </button>
              )}
            </div>
          )}
          {!picked && <p className="border-t border-line px-4 py-2 text-[11px] text-muted">Klik wilayah untuk menyematkan rincian.</p>}
        </div>
      )}
    </div>
  );
}
